FROM node:carbon-alpine

# Configure the environment
ENV NODE_ENV=production
# Log all debug information that is available
# The caller can modify this (and the DEBUG_LEVELS environment variable) if needed
ENV DEBUG=*
ENV DEBUG_LEVEL=verbose

WORKDIR /app
ENTRYPOINT ["npm", "start", "--"]

# Install the application
RUN mkdir -p /app
ADD deploy/ /app
