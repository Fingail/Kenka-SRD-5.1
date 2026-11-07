import { check } from './core.mjs';

export class DRClient {
  constructor(base, password) { this.base = base; this.password = password; this.sequence = 0; }
  async http(path, options = {}) {
    const response = await fetch(this.base + path, {
      ...options, headers: { Authorization: `Bearer ${this.password}`, ...(options.headers || {}) }, signal: AbortSignal.timeout(35000),
    });
    check(response.ok, `Dungeon Revealer request failed (${response.status}).`, 502);
    return response;
  }
  async connect() {
    const route = '/api/socket.io/?EIO=4&transport=polling';
    const text = await (await this.http(route)).text();
    this.route = `${route}&sid=${encodeURIComponent(JSON.parse(text.slice(1)).sid)}`;
    await this.send('40'); await this.receive();
    await this.emit('authenticate', { password: this.password, desiredRole: 'admin' });
    const events = await this.receive();
    check(events.some(event => event[0] === 'authenticated'), 'DR socket authentication failed.', 502);
  }
  async send(packet) { await this.http(this.route, { method: 'POST', body: packet, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }); }
  async emit(name, data) { await this.send('42' + JSON.stringify([name, data])); }
  async receive() {
    const result = [];
    for (const packet of (await (await this.http(this.route)).text()).split('\x1e')) {
      if (packet === '2') await this.send('3');
      else if (packet.startsWith('42')) result.push(JSON.parse(packet.slice(2)));
    }
    return result;
  }
  async gql(operation, variables = {}) {
    const id = ++this.sequence;
    await this.emit('@graphql/execute', { id, operation, variables });
    for (let n = 0; n < 5; n++) {
      for (const [event, result] of await this.receive()) {
        if (event === '@graphql/result' && result.id === id) {
          check(!result.errors, 'DR GraphQL operation failed: ' + result.errors?.map(x => x.message).join('; '), 502);
          return result.data;
        }
      }
    }
    throw Object.assign(new Error('DR GraphQL timeout.'), { status: 502 });
  }
  async close() { if (this.route) await this.send('41').catch(() => {}); }
  async upload(url, bytes, mime) {
    const parsed = new URL(url, this.base);
    check(/^\/(api\/)?files\/(map-image|token-image)\//.test(parsed.pathname), 'Unexpected DR upload path.', 502);
    await this.http(parsed.pathname, { method: 'PUT', body: bytes, headers: { 'Content-Type': mime } });
  }
  async image(media, title) {
    const result = (await this.gql(`mutation($i:RequestTokenImageUploadInput!){requestTokenImageUpload(input:$i){__typename ... on RequestTokenImageUploadDuplicate{tokenImage{id}} ... on RequestTokenImageUploadUrl{uploadUrl}}}`, { i: { sha256: media.hash, extension: media.extension } })).requestTokenImageUpload;
    if (result.tokenImage) return result.tokenImage.id;
    await this.upload(result.uploadUrl, media.bytes, media.mime);
    const created = (await this.gql(`mutation($i:TokenImageCreateInput!){tokenImageCreate(input:$i){__typename ... on TokenImageCreateSuccess{createdTokenImage{id}} ... on TokenImageCreateError{reason}}}`, { i: { title, sha256: media.hash } })).tokenImageCreate;
    check(created.createdTokenImage, 'DR token image creation failed.', 502);
    return created.createdTokenImage.id;
  }
}
