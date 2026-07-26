FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose API port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
