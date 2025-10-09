# Use Python 3.11 with CUDA 12.4 support
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHON_VERSION=3.11

# Install cuDNN 9 from NVIDIA repository
RUN apt-get update && apt-get install -y \
    software-properties-common \
    wget \
    && wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb \
    && dpkg -i cuda-keyring_1.1-1_all.deb \
    && apt-get update \
    && apt-get install -y libcudnn9-cuda-12 \
    && rm -rf /var/lib/apt/lists/* \
    && rm cuda-keyring_1.1-1_all.deb

# Install Python 3.11 specifically
RUN add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update && apt-get install -y \
    python3.11 \
    python3.11-dev \
    python3.11-distutils \
    python3-pip \
    ffmpeg \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.11 as default
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && update-alternatives --set python3 /usr/bin/python3.11

# Upgrade pip for Python 3.11
RUN python3 -m pip install --upgrade pip setuptools wheel

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install PyTorch with CUDA FIRST (before other dependencies)
RUN pip3 install --no-cache-dir \
    torch==2.5.1 \
    torchaudio==2.5.1 \
    --index-url https://download.pytorch.org/whl/cu124

# Install remaining dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Verify Python version and PyTorch CUDA
RUN python3 --version && \
    python3 -c "import torch; print(f'PyTorch version: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}'); print(f'CUDA version: {torch.version.cuda}')"

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p storage/uploads storage/transcripts storage/processed logs

# Expose ports
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# Production server
CMD ["hypercorn", "app.main:app", "--bind", "0.0.0.0:8000", "--keep-alive", "300", "--workers", "1"]