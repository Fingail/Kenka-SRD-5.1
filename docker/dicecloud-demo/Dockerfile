FROM node:14.21.3-bullseye@sha256:c0bff0d29a742f40650d5f0305dd581351c10954e6cb6676fc96f47590b9666e AS build
ENV METEOR_ALLOW_SUPERUSER=1
RUN curl -fsSL 'https://install.meteor.com/?release=2.16' -o /tmp/install-meteor.sh
RUN sh /tmp/install-meteor.sh
ENV PATH="/root/.meteor:${PATH}"
WORKDIR /build/app
COPY app/ ./
# The pinned Meteor release uses Node 14; upstream's sharp 0.33 requires Node 18.
# Keep the native image library on the compatible 0.32 release for this demo.
RUN npm install --package-lock-only --ignore-scripts --no-audit --no-fund sharp@0.32.6
RUN npm ci --no-audit --no-fund
COPY .demo-patches/patch-native-client.cjs /build/patch-native-client.cjs
RUN node /build/patch-native-client.cjs /build/app
RUN meteor build /build/output --directory --architecture os.linux.x86_64 --allow-superuser
WORKDIR /build/output/bundle/programs/server
RUN npm install --production --no-audit --no-fund encoding@0.1.13
COPY .demo-patches/patch-library-copy.cjs /build/patch-library-copy.cjs
RUN node /build/patch-library-copy.cjs /build/output/bundle/programs/server/app/app.js
COPY .demo-patches/patch-native.cjs /build/patch-native.cjs
RUN node /build/patch-native.cjs /build/output/bundle/programs/server/app/app.js

FROM node:14.21.3-bullseye@sha256:c0bff0d29a742f40650d5f0305dd581351c10954e6cb6676fc96f47590b9666e
LABEL org.opencontainers.image.source="https://github.com/ThaumRystra/DiceCloud" \
      org.opencontainers.image.revision="88fc9c8321796437017e60e84b9582b5aac44cf1" \
      org.opencontainers.image.licenses="GPL-3.0"
WORKDIR /opt/dicecloud
COPY --from=build --chown=node:node /build/output/bundle/ ./
COPY --chown=node:node License.md /usr/share/doc/dicecloud/License.md
RUN mkdir -p /data/files/userImages /data/files/archiveCreatures programs/server/assets/app \
    && ln -s /data/files/userImages programs/server/assets/app/userImages \
    && ln -s /data/files/archiveCreatures programs/server/assets/app/archiveCreatures \
    && ln -s programs/server/assets assets \
    && chown -R node:node /data/files
USER node
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "main.js"]
