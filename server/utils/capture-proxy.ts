import http from 'node:http';
import net from 'node:net';
import {lookup} from 'node:dns/promises';
import type {Socket} from 'node:net';
import {parsePublicUrl, publicAddress} from '../capture/validation';

// Resolve at connection time and connect to the checked IP. Every browser request,
// including redirects and subresources, passes through this restricted proxy.
export async function publicEndpoint(host: string) {
  const answers = await lookup(host.replace(/^\[|\]$/g, ''), {all:true, verbatim:true});
  if (!answers.length || answers.some(a => !publicAddress(a.address))) throw new Error('Private destination');
  return answers[0];
}
export async function captureProxy() {
  const sockets = new Set<Socket>();
  const track = (socket:Socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => socket.destroy()); return socket; };
  const server = http.createServer(async (req,res) => {
    try {
      const url = parsePublicUrl(req.url || '');
      if (url.protocol !== 'http:') throw new Error('Unsupported proxy request');
      const address = await publicEndpoint(url.hostname);
      if(res.destroyed)return;
      const headers:http.OutgoingHttpHeaders = {...req.headers, host:url.host}; delete headers['proxy-authorization']; delete headers['proxy-connection'];
      const upstream = http.request({host:address.address, family:address.family, port:80, path:url.pathname+url.search, method:req.method, headers, agent:false}, response => {
        res.writeHead(response.statusCode || 502,response.headers); response.pipe(res);
      });
      upstream.on('socket',track); upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});
      res.on('close',()=>upstream.destroy());req.pipe(upstream);
    } catch {res.writeHead(403);res.end();}
  });
  server.on('connection',track);
  server.on('connect',async(req,client,head)=>{
    try {
      const url = parsePublicUrl(`https://${req.url}`);
      if(!req.url?.endsWith(':443') || (url.port && url.port !== '443'))throw new Error('Invalid tunnel port');
      const address = await publicEndpoint(url.hostname);
      if(client.destroyed)return;
      const upstream = track(net.connect({host:address.address,port:443,family:address.family}));
      client.on('close',()=>upstream.destroy());upstream.on('close',()=>client.destroy());
      upstream.once('connect',()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);client.pipe(upstream);upstream.pipe(client);});
    } catch {client.end('HTTP/1.1 403 Forbidden\r\n\r\n');}
  });
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address() as net.AddressInfo;
  return {url:`http://127.0.0.1:${address.port}`,close:async()=>{for(const socket of sockets)socket.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
