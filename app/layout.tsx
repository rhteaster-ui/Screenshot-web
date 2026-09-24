import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={
  title:'FOLIO — Tangkap Web. Simpan.',
  description:'Capture halaman web ke JPG, PNG, WEBP, dan PDF. Atur viewport, capture satu atau banyak URL, lalu unduh hasilnya.',
  metadataBase:new URL('https://folio-web-capture.mahadewa156.chatgpt.site'),
  openGraph:{title:'FOLIO — Web Capture Instrument',description:'Screenshot halaman web dalam JPG, PNG, WEBP, atau PDF.',locale:'id_ID',type:'website'},
  icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'},robots:{index:true,follow:true}
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="id"><body>{children}</body></html>;}
