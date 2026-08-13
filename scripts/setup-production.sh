#!/bin/bash

# setup-production.sh
# Pulls the necessary lightweight images for the VPS execution containers

echo "Starting Production Setup..."

# We need alpine as the base OS for our lightweight VPS containers
echo "Pulling alpine Linux..."
docker pull alpine:latest

# Build the custom Docker image using the Dockerfile in the repository root
echo "Building coderank-base image..."
docker build -t coderank-base:latest -f ../Dockerfile ..

echo "Setup Complete."
