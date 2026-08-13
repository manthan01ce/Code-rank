FROM alpine:latest

# Install bash, standard C/C++ compilers, Python 3, Java 17, and Node.js
RUN apk add --no-cache \
    bash \
    gcc \
    g++ \
    python3 \
    openjdk17-jre \
    nodejs

# Set working directory
WORKDIR /app

# The container will just idle, waiting for code execution commands via `docker exec`
CMD ["tail", "-f", "/dev/null"]
