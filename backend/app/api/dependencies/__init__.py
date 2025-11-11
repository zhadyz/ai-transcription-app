"""
API dependencies module.
FastAPI dependency injection for authentication, authorization, and common utilities.
"""

from .auth_deps import (
    get_current_user,
    get_current_active_user,
    get_current_verified_user,
    get_optional_current_user,
    require_admin,
    require_premium,
    require_user,
    RoleChecker,
    get_client_ip,
    get_user_agent,
    get_device_info
)

__all__ = [
    "get_current_user",
    "get_current_active_user",
    "get_current_verified_user",
    "get_optional_current_user",
    "require_admin",
    "require_premium",
    "require_user",
    "RoleChecker",
    "get_client_ip",
    "get_user_agent",
    "get_device_info"
]
