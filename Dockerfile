FROM node:24.19.0

ENV NODE_ENV production
ENV PORT 3000
EXPOSE 3000

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm ci

# Bundle app source
COPY . .

CMD [ "node", "index.js" ]
