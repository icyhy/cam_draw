# 使用Nginx作为基础镜像
FROM nginx:latest

# 将项目文件复制到Nginx的默认网页目录
COPY . /usr/share/nginx/html

# 暴露80端口
EXPOSE 80

# 启动Nginx服务
CMD ["nginx", "-g", "daemon off;"]