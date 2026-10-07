import { OdooClient, OdooError, odooConfigFromEnv } from './odoo-client';

const cfg = { url: 'https://odoo.test', db: 'db1', login: 'bot@x.qa', apiKey: 'secret-key' };

interface RpcBody {
  params: { service: string; method: string; args: unknown[] };
}

/** A fetch stand-in that answers each call from a queue and records the requests. */
function fakeFetch(...answers: object[]) {
  const calls: { url: string; body: RpcBody }[] = [];
  const fn = ((url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(init?.body as string) as RpcBody });
    const next = answers.shift();
    return Promise.resolve(
      next instanceof Response
        ? next
        : new Response(JSON.stringify(next), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
  }) as typeof fetch;
  return { fn, calls };
}

describe('odooConfigFromEnv', () => {
  it('reads the four variables and trims the URL', () => {
    expect(odooConfigFromEnv({ ODOO_URL: ' https://o.test/ ', ODOO_DB: 'd', ODOO_LOGIN: 'l', ODOO_API_KEY: 'k' })).toEqual({
      url: 'https://o.test',
      db: 'd',
      login: 'l',
      apiKey: 'k',
    });
  });

  it('names every missing variable', () => {
    expect(() => odooConfigFromEnv({ ODOO_URL: 'https://o.test', ODOO_DB: '' })).toThrow('ODOO_DB, ODOO_LOGIN, ODOO_API_KEY');
  });
});

describe('OdooClient', () => {
  it('authenticates once, then calls search_read with the uid and key', async () => {
    const { fn, calls } = fakeFetch({ result: 7 }, { result: [{ id: 1 }] }, { result: [{ id: 2 }] });
    const client = new OdooClient(cfg, fn);

    expect(await client.searchRead('product.product', [['sale_ok', '=', true]], ['display_name'], { lang: 'ar_001' })).toEqual([{ id: 1 }]);
    expect(await client.read('product.product', [2], ['image_1920'])).toEqual([{ id: 2 }]);

    expect(calls).toHaveLength(3);
    expect(calls[0].url).toBe('https://odoo.test/jsonrpc');
    expect(calls[0].body.params).toEqual({ service: 'common', method: 'authenticate', args: ['db1', 'bot@x.qa', 'secret-key', {}] });
    expect(calls[1].body.params).toEqual({
      service: 'object',
      method: 'execute_kw',
      args: ['db1', 7, 'secret-key', 'product.product', 'search_read', [[['sale_ok', '=', true]]], { fields: ['display_name'], context: { lang: 'ar_001' } }],
    });
    expect(calls[2].body.params.args.slice(3)).toEqual(['product.product', 'read', [[2]], { fields: ['image_1920'] }]);
  });

  it('stops with a clear message when Odoo rejects the login', async () => {
    const { fn } = fakeFetch({ result: false });
    await expect(new OdooClient(cfg, fn).searchRead('product.product', [], ['id'])).rejects.toThrow('Odoo rejected the login');
  });

  it('reports the Odoo error message, never the API key', async () => {
    const { fn } = fakeFetch({ result: 7 }, { error: { message: 'Odoo Server Error', data: { message: 'Access Denied for secret-key' } } });
    const err = await new OdooClient(cfg, fn).searchRead('product.product', [], ['id']).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OdooError);
    expect((err as Error).message).toContain('Access Denied');
    expect((err as Error).message).not.toContain('secret-key');
  });

  it('explains a non-JSON answer such as a proxy error page', async () => {
    const { fn } = fakeFetch(new Response('<html><h1>502 Bad Gateway</h1></html>', { status: 502 }));
    await expect(new OdooClient(cfg, fn).searchRead('product.product', [], ['id'])).rejects.toThrow(
      'Odoo answered HTTP 502 with something that is not JSON',
    );
  });
});
