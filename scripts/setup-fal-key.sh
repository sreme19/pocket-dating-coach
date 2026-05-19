#!/bin/bash

# Setup script for FAL_KEY configuration
# Usage: ./scripts/setup-fal-key.sh [key]
# If no key provided, prompts interactively

set -e

ENV_FILE=".env.local"
KEY_NAME="FAL_KEY"

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== FAL.AI Key Setup ===${NC}"

# Check if key provided as argument
if [ -n "$1" ]; then
    FAL_KEY="$1"
    echo -e "${YELLOW}Using provided key${NC}"
else
    # Prompt for key interactively
    echo -e "${YELLOW}Enter your FAL_KEY (get it from https://fal.ai):${NC}"
    read -sp "FAL_KEY: " FAL_KEY
    echo
fi

if [ -z "$FAL_KEY" ]; then
    echo -e "${YELLOW}No key provided. Skipping setup.${NC}"
    exit 0
fi

# Check if .env.local exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Creating $ENV_FILE${NC}"
    touch "$ENV_FILE"
fi

# Check if FAL_KEY already exists
if grep -q "^${KEY_NAME}=" "$ENV_FILE"; then
    # Replace existing key
    sed -i '' "s|^${KEY_NAME}=.*|${KEY_NAME}=${FAL_KEY}|" "$ENV_FILE"
    echo -e "${GREEN}✓ Updated ${KEY_NAME} in ${ENV_FILE}${NC}"
else
    # Append new key
    echo "${KEY_NAME}=${FAL_KEY}" >> "$ENV_FILE"
    echo -e "${GREEN}✓ Added ${KEY_NAME} to ${ENV_FILE}${NC}"
fi

echo -e "${GREEN}✓ Setup complete!${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo "1. Restart your dev server (npm run dev)"
echo "2. Go through verification and upload a photo"
echo "3. Click 'Enhance with AI' on the profile page"
