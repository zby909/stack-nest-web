FROM node:24-alpine AS builder

WORKDIR /src
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . ./
RUN pnpm build

FROM nginx:1.29-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY --from=builder /src/dist/ /usr/share/nginx/html/

EXPOSE 80
