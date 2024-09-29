import { createServer, request as httpRequest } from 'node:http';
import { parse } from 'node:url';

const defaultProxyOptions = {
  proxyPort: 8080,
  mitmPort: 8000,
};

function processUrl(request, type) {
  const reqUrl = parse(request.url, true);
  if(!reqUrl.protocol) {
    reqUrl.protocol = type + ":";
  }

  if(!reqUrl.hostname) {
    reqUrl.hostname = request.headers.host;
  }

  return reqUrl;
}
  
export class Proxy{
  constructor(options){
    this.options = options || defaultProxyOptions;

    this.mitmServer = createServer((request, response) => {
      this.#handleRequest(request, response, "http");
    });
    
    this.mitmServer.addListener('error', () => {
      console.log("error on mitm server")
    });
    
    this.server = createServer((request, response) => {
      this.#handleRequest(request, response, "http");
    });

    this.server.addListener('error', () => {
      sys.log("error on server?")
    });
  }

  listen() {
    this.mitmServer.listen(this.options.mitmPort);
    this.server.listen(this.options.proxyPort);
  }

  #handleRequest(request, response, type) {
    const requestUrl = processUrl(request, type);
    const hostname  = requestUrl.hostname;
    const pathname  = requestUrl.pathname + ( requestUrl.search || "");
  
    const headers = request.headers;
    delete request.headers['proxy-connection'];

    const requestOptions = {
      host: hostname,
      port: requestUrl.port || (type == "http" ? 80 : 443),
      path: pathname,
      headers: headers,
      method: request.method,
    }

    console.log('request options:' + '\n' + JSON.stringify(requestOptions) + '\n');
  
    const proxyRequest = httpRequest(requestOptions, (proxyResponse) => {
      proxyResponse.on("data", (data) => {
        console.log('response body:' + '\n' + data.toString('utf8') + '\n');
        response.write(data);
      });
  
      proxyResponse.on("end", () => {
        response.end();
      });
  
      proxyResponse.on('close', () => {
        response.end();
      });
  
      proxyResponse.on("error", function(err) {});
      response.writeHead(proxyResponse.statusCode, proxyResponse.headers);

      console.log('response status code:' + '\n' + JSON.stringify(proxyResponse.statusCode));
      console.log('response headers:' + '\n' + JSON.stringify(proxyResponse.headers));
    });
  
    proxyRequest.on('error', (err) => {
      response.end(); 
    });
  
    request.on('data', (data) => {
      proxyRequest.write(data, 'binary');
    });
  
    request.on('end', () => {
      proxyRequest.end();
    });
  
    request.on('close', () => {
      proxyRequest.connection.end();
    });
  
    request.on('error', (exception) => { 
      response.end(); 
    });
  }
}
