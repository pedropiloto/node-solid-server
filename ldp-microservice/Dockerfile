FROM node:8.11.2-onbuild
COPY . .
COPY config.json-default config.json
RUN npm install
RUN npm install -g nodemon
RUN chmod +x wait-for-it.sh

RUN openssl req \
    -new \
    -newkey rsa:4096 \
    -days 365 \
    -nodes \
    -x509 \
    -subj "/C=US/ST=Denial/L=Springfield/O=Dis/CN=*.solid.com" \
    -keyout ../privkey.pem \
    -out ../fullchain.pem
