FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS node
FROM composer:2@sha256:8de2184c6de224f4689e8f80ed5f5edaf0030b6b8b7839a22a2bcb6722ac87d0 AS composer
FROM php:8.5-cli-bookworm@sha256:050713ce008e2360ea9dc96e1f9a075690132388d917fc3552806f7a7be6f2a0

ARG WWWGROUP=1000
ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /var/www/html
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git unzip zip gosu supervisor mariadb-client \
    libzip-dev libicu-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev \
    libonig-dev libsqlite3-dev libxml2-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j2 pdo_mysql pdo_sqlite mbstring intl zip gd bcmath exif pcntl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer /usr/bin/composer /usr/local/bin/composer
COPY --from=node /usr/local/ /usr/local/
COPY --from=node /opt/ /opt/
RUN yarn --version \
    && groupadd --force -g ${WWWGROUP} sail \
    && useradd -ms /bin/bash --no-user-group -g ${WWWGROUP} -u 1337 sail
COPY docker/8.5/start-container /usr/local/bin/start-container
COPY docker/local/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/local/php.ini /usr/local/etc/php/conf.d/99-local.ini
RUN chmod +x /usr/local/bin/start-container
ENV SUPERVISOR_PHP_USER=sail
ENV SUPERVISOR_PHP_COMMAND="php -d variables_order=EGPCS /var/www/html/artisan serve --host=0.0.0.0 --port=8080"
EXPOSE 8080
ENTRYPOINT ["start-container"]
