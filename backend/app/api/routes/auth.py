"""
Authentication API routes.
Handles user registration, login, logout, password reset, and token management.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
import logging

from app.db.database import get_db
from app.services import auth_service
from app.models.auth import (
    UserRegistrationRequest,
    LoginRequest,
    TokenRefreshRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
    PasswordChangeRequest,
    LogoutRequest,
    LoginResponse,
    RegistrationResponse,
    TokenResponse,
    UserResponse,
    PasswordResetResponse,
    PasswordResetConfirmResponse,
    MessageResponse,
    SessionListResponse,
    SessionInfo,
    CurrentUser
)
from app.api.dependencies.auth_deps import (
    get_current_user,
    get_client_ip,
    get_device_info,
    get_user_agent
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ============================================================================
# REGISTRATION
# ============================================================================

@router.post(
    "/register",
    response_model=RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user",
    description="Create a new user account with email and password"
)
async def register(
    request: Request,
    data: UserRegistrationRequest,
    db: Session = Depends(get_db)
):
    """
    Register a new user account.

    - **email**: Valid email address (will be normalized)
    - **password**: Strong password (min 8 chars, uppercase, lowercase, digit, special char)
    - **full_name**: User's full name
    - **organization**: Optional organization name

    Returns user profile and authentication tokens.
    Email verification link is sent to the provided email.
    """
    try:
        # Create user
        user = auth_service.create_user(
            db=db,
            email=data.email,
            password=data.password,
            full_name=data.full_name,
            organization=data.organization
        )

        # Create session
        session = auth_service.create_session(
            db=db,
            user_id=user.id,
            device_info=get_device_info(request),
            ip_address=get_client_ip(request)
        )

        # Generate tokens
        access_token, expires_in = auth_service.create_access_token(
            user_id=user.id,
            email=user.email,
            role=user.role,
            session_id=session.id
        )

        refresh_token, expires_at, jti = auth_service.create_refresh_token(
            user_id=user.id,
            email=user.email,
            role=user.role,
            session_id=session.id
        )

        # Store refresh token
        auth_service.store_refresh_token(
            db=db,
            token=refresh_token,
            jti=jti,
            user_id=user.id,
            session_id=session.id,
            expires_at=expires_at
        )

        # Log audit event
        auth_service.log_audit_event(
            db=db,
            event_type="registration",
            event_status="success",
            user_id=user.id,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            description=f"New user registered: {user.email}"
        )

        return RegistrationResponse(
            user=UserResponse.model_validate(user),
            tokens=TokenResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                token_type="bearer",
                expires_in=expires_in
            ),
            message="Registration successful. Please check your email to verify your account."
        )

    except auth_service.AuthenticationError as e:
        # Log failed registration
        auth_service.log_audit_event(
            db=db,
            event_type="registration",
            event_status="failure",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            description=f"Registration failed: {e.message}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    except Exception as e:
        logger.error(f"Registration error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again."
        )


# ============================================================================
# LOGIN
# ============================================================================

@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Login user",
    description="Authenticate user with email and password"
)
async def login(
    request: Request,
    data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Login with email and password.

    - **email**: Registered email address
    - **password**: Account password
    - **remember_me**: If true, extends session duration to 60 days

    Returns user profile and authentication tokens.
    """
    try:
        # Authenticate user
        user = auth_service.authenticate_user(
            db=db,
            email=data.email,
            password=data.password
        )

        if not user:
            # Log failed login
            auth_service.log_audit_event(
                db=db,
                event_type="login",
                event_status="failure",
                ip_address=get_client_ip(request),
                user_agent=get_user_agent(request),
                description=f"Failed login attempt for {data.email}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )

        # Create session
        session = auth_service.create_session(
            db=db,
            user_id=user.id,
            device_info=get_device_info(request),
            ip_address=get_client_ip(request),
            remember_me=data.remember_me
        )

        # Generate tokens
        access_token, expires_in = auth_service.create_access_token(
            user_id=user.id,
            email=user.email,
            role=user.role,
            session_id=session.id
        )

        refresh_token, expires_at, jti = auth_service.create_refresh_token(
            user_id=user.id,
            email=user.email,
            role=user.role,
            session_id=session.id,
            remember_me=data.remember_me
        )

        # Store refresh token
        auth_service.store_refresh_token(
            db=db,
            token=refresh_token,
            jti=jti,
            user_id=user.id,
            session_id=session.id,
            expires_at=expires_at
        )

        # Log successful login
        auth_service.log_audit_event(
            db=db,
            event_type="login",
            event_status="success",
            user_id=user.id,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            description=f"Successful login: {user.email}"
        )

        return LoginResponse(
            user=UserResponse.model_validate(user),
            tokens=TokenResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                token_type="bearer",
                expires_in=expires_in
            )
        )

    except auth_service.AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed. Please try again."
        )


# ============================================================================
# LOGOUT
# ============================================================================

@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout user",
    description="Revoke current session and tokens"
)
async def logout(
    request: Request,
    data: LogoutRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Logout current user.

    - **all_devices**: If true, logout from all devices/sessions

    Invalidates the current session and all associated tokens.
    """
    try:
        if data.all_devices:
            # Revoke all sessions
            auth_service.revoke_all_user_sessions(db, current_user.id)
            message = "Logged out from all devices"
        else:
            # Revoke only current session
            auth_service.revoke_session(db, current_user.session_id)
            message = "Logged out successfully"

        # Log audit event
        auth_service.log_audit_event(
            db=db,
            event_type="logout",
            event_status="success",
            user_id=current_user.id,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            description=message
        )

        return MessageResponse(message=message)

    except Exception as e:
        logger.error(f"Logout error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )


# ============================================================================
# TOKEN REFRESH
# ============================================================================

@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    description="Get a new access token using refresh token"
)
async def refresh_token(
    request: Request,
    data: TokenRefreshRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token.

    - **refresh_token**: Valid refresh token

    Returns a new access token. The refresh token remains valid.
    Implements token rotation for enhanced security.
    """
    try:
        # Decode refresh token
        payload = auth_service.decode_token(data.refresh_token)

        # Verify it's a refresh token
        if payload.type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token type. Expected refresh token."
            )

        # Verify refresh token exists and is valid
        refresh_token_record = auth_service.verify_refresh_token(db, data.refresh_token)

        if not refresh_token_record:
            # Log suspicious activity
            auth_service.log_audit_event(
                db=db,
                event_type="token_refresh",
                event_status="failure",
                ip_address=get_client_ip(request),
                user_agent=get_user_agent(request),
                description="Attempted to use invalid/revoked refresh token"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked refresh token"
            )

        # Get user
        user = auth_service.get_user_by_id(db, payload.sub)

        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )

        # Verify session is still active
        session = auth_service.get_active_session(db, payload.session_id)

        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has expired. Please login again."
            )

        # Generate new access token
        access_token, expires_in = auth_service.create_access_token(
            user_id=user.id,
            email=user.email,
            role=user.role,
            session_id=session.id
        )

        # Optional: Implement refresh token rotation
        # Mark old token as used and generate new refresh token
        refresh_token_record.is_used = True
        refresh_token_record.used_at = auth_service.datetime.utcnow()

        # Generate new refresh token
        new_refresh_token, expires_at, jti = auth_service.create_refresh_token(
            user_id=user.id,
            email=user.email,
            role=user.role,
            session_id=session.id
        )

        # Store new refresh token
        new_token_record = auth_service.store_refresh_token(
            db=db,
            token=new_refresh_token,
            jti=jti,
            user_id=user.id,
            session_id=session.id,
            expires_at=expires_at
        )

        # Link old token to new token (rotation chain)
        refresh_token_record.replaced_by_token_id = new_token_record.id
        db.commit()

        # Log audit event
        auth_service.log_audit_event(
            db=db,
            event_type="token_refresh",
            event_status="success",
            user_id=user.id,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            description="Access token refreshed"
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=expires_in
        )

    except auth_service.TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired. Please login again."
        )
    except auth_service.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid refresh token: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )


# ============================================================================
# PASSWORD RESET
# ============================================================================

@router.post(
    "/password-reset",
    response_model=PasswordResetResponse,
    summary="Request password reset",
    description="Send password reset email"
)
async def request_password_reset(
    request: Request,
    data: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    """
    Request password reset email.

    - **email**: Registered email address

    Sends a password reset link to the email if it exists.
    Always returns success to prevent email enumeration.
    """
    try:
        # Initiate password reset
        reset_token = auth_service.initiate_password_reset(db, data.email)

        # Log audit event
        auth_service.log_audit_event(
            db=db,
            event_type="password_reset_request",
            event_status="success",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            description=f"Password reset requested for {data.email}"
        )

        # TODO: Send email with reset token
        # In production, integrate with email service (SendGrid, AWS SES, etc.)
        logger.info(f"Password reset token for {data.email}: {reset_token}")

        # Always return success to prevent email enumeration
        return PasswordResetResponse(
            message="If your email is registered, you will receive password reset instructions.",
            email=data.email
        )

    except Exception as e:
        logger.error(f"Password reset request error: {e}", exc_info=True)
        # Still return success to prevent information leakage
        return PasswordResetResponse(
            message="If your email is registered, you will receive password reset instructions.",
            email=data.email
        )


@router.post(
    "/password-reset/confirm",
    response_model=PasswordResetConfirmResponse,
    summary="Confirm password reset",
    description="Reset password with token from email"
)
async def confirm_password_reset(
    request: Request,
    data: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """
    Confirm password reset with token.

    - **reset_token**: Token from password reset email
    - **new_password**: New password (must meet strength requirements)

    Resets the password and invalidates the reset token.
    """
    try:
        # Confirm password reset
        auth_service.confirm_password_reset(
            db=db,
            reset_token=data.reset_token,
            new_password=data.new_password
        )

        # Log audit event
        auth_service.log_audit_event(
            db=db,
            event_type="password_reset_confirm",
            event_status="success",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            description="Password reset completed"
        )

        return PasswordResetConfirmResponse(
            message="Password has been reset successfully. You can now login with your new password."
        )

    except auth_service.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except auth_service.TokenExpiredError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Password reset confirm error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset failed"
        )


@router.post(
    "/password-change",
    response_model=MessageResponse,
    summary="Change password",
    description="Change password for authenticated user"
)
async def change_password(
    request: Request,
    data: PasswordChangeRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change password for authenticated user.

    - **current_password**: Current password
    - **new_password**: New password (must be different and meet strength requirements)

    Requires valid access token. Revokes all other sessions for security.
    """
    try:
        # Change password
        auth_service.change_password(
            db=db,
            user_id=current_user.id,
            current_password=data.current_password,
            new_password=data.new_password
        )

        # Revoke all other sessions (keep current session active)
        auth_service.revoke_all_user_sessions(
            db=db,
            user_id=current_user.id,
            except_session_id=current_user.session_id
        )

        # Log audit event
        auth_service.log_audit_event(
            db=db,
            event_type="password_change",
            event_status="success",
            user_id=current_user.id,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            description="Password changed successfully"
        )

        return MessageResponse(
            message="Password changed successfully. All other sessions have been logged out."
        )

    except auth_service.AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    except Exception as e:
        logger.error(f"Password change error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )


# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

@router.get(
    "/sessions",
    response_model=SessionListResponse,
    summary="List active sessions",
    description="Get all active sessions for current user"
)
async def list_sessions(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all active sessions for the current user.

    Shows device information, IP address, and last activity for each session.
    Useful for security monitoring and multi-device management.
    """
    try:
        from app.db.models import Session as DBSession

        sessions = db.query(DBSession).filter(
            DBSession.user_id == current_user.id,
            DBSession.is_active == True
        ).order_by(DBSession.last_activity_at.desc()).all()

        session_list = [
            SessionInfo(
                session_id=session.id,
                device_info=session.device_info or "Unknown",
                ip_address=session.ip_address or "Unknown",
                created_at=session.created_at,
                last_activity=session.last_activity_at,
                is_current=session.id == current_user.session_id
            )
            for session in sessions
        ]

        return SessionListResponse(
            sessions=session_list,
            total=len(session_list)
        )

    except Exception as e:
        logger.error(f"List sessions error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve sessions"
        )


@router.delete(
    "/sessions/{session_id}",
    response_model=MessageResponse,
    summary="Revoke session",
    description="Revoke a specific session"
)
async def revoke_session(
    session_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Revoke a specific session.

    - **session_id**: ID of session to revoke

    Cannot revoke current session. Use /logout for that.
    """
    try:
        if session_id == current_user.session_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot revoke current session. Use /logout instead."
            )

        # Verify session belongs to user
        from app.db.models import Session as DBSession

        session = db.query(DBSession).filter(
            DBSession.id == session_id,
            DBSession.user_id == current_user.id
        ).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        # Revoke session
        auth_service.revoke_session(db, session_id, reason="revoked_by_user")

        return MessageResponse(message="Session revoked successfully")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Revoke session error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke session"
        )


# ============================================================================
# USER PROFILE
# ============================================================================

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
    description="Get profile information for authenticated user"
)
async def get_current_user_profile(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current user profile.

    Returns detailed profile information for the authenticated user.
    """
    try:
        user = auth_service.get_user_by_id(db, current_user.id)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        return UserResponse.model_validate(user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get profile error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve profile"
        )
