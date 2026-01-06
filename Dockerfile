# 第一阶段：构建 React 应用
FROM node:18-alpine as builder

WORKDIR /app

# 1. 复制依赖清单
COPY package.json ./

# 2. 安装依赖
RUN npm install

# 3. 复制源代码并构建
COPY . .
RUN npm run build

# 第二阶段：使用 Nginx 部署
FROM nginx:alpine

# 1. 删除默认的 Nginx 配置，防止冲突
RUN rm -f /etc/nginx/conf.d/default.conf

# 2. 复制构建好的网页文件到 Nginx 目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 3. 复制 Nginx 模板配置（支持环境变量动态替换）
#    官方 Nginx 镜像会在启动时自动用 envsubst 处理 /etc/nginx/templates/*.template
#    并输出到 /etc/nginx/conf.d/
COPY templates/default.conf.template /etc/nginx/templates/default.conf.template

# [关键修复] 确保 Nginx 用户有权限读取文件，防止 403 Forbidden
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /usr/share/nginx/html

# 4. 暴露 8080 端口（与 Nginx 配置一致）
EXPOSE 8080

# 启动前准备：动态获取 DNS 解析服务器
RUN echo 'export DNS_RESOLVER=$(cat /etc/resolv.conf | grep nameserver | awk "{print \$2}" | head -n 1)' > /docker-entrypoint.d/00-fix-dns.sh && \
    chmod +x /docker-entrypoint.d/00-fix-dns.sh

# 启动 Nginx
CMD ["/bin/sh", "-c", ". /docker-entrypoint.d/00-fix-dns.sh && /docker-entrypoint.sh nginx -g \"daemon off;\""]