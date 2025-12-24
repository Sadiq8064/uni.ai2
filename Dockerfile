FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

# Expose server port

EXPOSE 8080


# Start your app
CMD ["npm", "start"]
