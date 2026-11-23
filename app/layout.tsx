import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Pipwise — Journal Community',description:'Every trade teaches. Capture your process, share your lessons, and grow with a community of thoughtful traders.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
