import {chromium} from 'playwright';
import sharp from 'sharp';
import {zipSync} from 'fflate';
import {captureProxy} from '../../utils/capture-proxy';
import {CaptureError} from '../errors';
import {MIME} from '../parser';
import {parsePublicUrl} from '../validation';
import type {CaptureProvider,Config} from '../model';

export function playwrightProvider(config:Config):CaptureProvider {
  return {async capture(options,signal) {
    signal.throwIfAborted();
    const proxy=await captureProxy();
    let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
    const abort=()=>{void browser?.close();void proxy.close();};
    signal.addEventListener('abort',abort,{once:true});
    try {
      browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,chromiumSandbox:process.env.CHROMIUM_SANDBOX!=='false',proxy:{server:proxy.url},args:['--proxy-bypass-list=<-loopback>','--disable-quic','--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],timeout:Math.min(config.timeout,30000)});
      signal.throwIfAborted();
      const files:Record<string,Uint8Array>={};let total=0;
      for(let index=0;index<options.targets.length;index++) {
        signal.throwIfAborted();
        const target=options.targets[index];const {width,height,scale,fullPage}=options.viewport;
        const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:scale,colorScheme:options.appearance.darkMode?'dark':'light',serviceWorkers:'block',acceptDownloads:false});
        try {
          await context.route('**/*',async route=>{try{parsePublicUrl(route.request().url());await route.continue();}catch{await route.abort();}});
          await context.routeWebSocket('**/*',socket=>socket.close());
          const page=await context.newPage();
          page.setDefaultTimeout(Math.min(config.timeout,30000));
          const response=await page.goto(target,{waitUntil:'load'});
          if(!response || response.status()>=400)throw new CaptureError('TARGET_UNAVAILABLE','Halaman tidak dapat dibuka atau membatasi capture.',422);
          await page.waitForTimeout(options.timing.delay*1000);
          await page.evaluate(()=>document.fonts.ready);
          const size=await page.evaluate(()=>({width:Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0),height:Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0)}));
          if(fullPage && (size.width*size.height*scale*scale>32000000 || size.height>30000))throw new CaptureError('OUTPUT_TOO_LARGE','Halaman terlalu panjang. Gunakan area Viewport atau scale lebih kecil.',422);
          let bytes:Uint8Array;
          if(options.output.format==='pdf') {
            await page.emulateMedia({media:'screen'});
            // PDF follows Chromium print pagination. Scale is independent of raster DPR.
            bytes=await page.pdf({width:`${width}px`,height:`${fullPage?size.height:height}px`,printBackground:true,scale,margin:{top:0,right:0,bottom:0,left:0},pageRanges:fullPage?'':'1'});
          } else {
            const raw=await page.screenshot({type:options.output.format==='jpeg'?'jpeg':'png',...(options.output.format==='jpeg'?{quality:90}:{}),fullPage,timeout:30000});
            bytes=options.output.format==='webp'?await sharp(raw).webp({quality:90}).toBuffer():raw;
          }
          total+=bytes.length;
          if(total>config.maxOutput)throw new CaptureError('OUTPUT_TOO_LARGE','Hasil terlalu besar. Kurangi resolusi atau jumlah URL.',422);
          const name=`${String(index+1).padStart(2,'0')}-${new URL(target).hostname.replace(/[^a-zA-Z0-9.-]/g,'_')}-${width}x${height}.${options.output.format}`;
          files[name]=bytes;
        } finally {await context.close();}
      }
      signal.throwIfAborted();
      if(options.mode==='batch'){
        const bytes=zipSync(files,{level:0});
        if(bytes.length>config.maxOutput)throw new CaptureError('OUTPUT_TOO_LARGE','Arsip terlalu besar. Kurangi jumlah URL.',422);
        return {bytes,filename:'folio-captures.zip',mimeType:'application/zip'};
      }
      const [filename,bytes]=Object.entries(files)[0];return {bytes,filename,mimeType:MIME[options.output.format]};
    } catch(error) {
      signal.throwIfAborted();
      if(error instanceof CaptureError)throw error;
      console.error('[browser capture]',error instanceof Error?error.message:'Unknown error');
      throw new CaptureError('CAPTURE_FAILED','Halaman gagal di-capture. Periksa URL atau coba halaman publik lain.',502);
    } finally {signal.removeEventListener('abort',abort);await browser?.close();await proxy.close();}
  }};
}
