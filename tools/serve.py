#!/usr/bin/env python3
import argparse
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
class Handler(SimpleHTTPRequestHandler):
 def end_headers(self):
  self.send_header('Cross-Origin-Opener-Policy','same-origin')
  self.send_header('Cross-Origin-Embedder-Policy','require-corp')
  self.send_header('Cache-Control','no-store')
  super().end_headers()
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=4174);a=p.parse_args()
 root=Path(__file__).resolve().parents[1]/'web'
 server=ThreadingHTTPServer(('127.0.0.1',a.port),partial(Handler,directory=str(root)))
 print('http://127.0.0.1:{}/'.format(a.port),flush=True);server.serve_forever()
