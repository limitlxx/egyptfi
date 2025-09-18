declare module 'next/server' {
  export class NextRequest {
    json(): Promise<any>;
    headers: {
      get(name: string): string | null;
    };
  }
  export class NextResponse {
    static json(body: any, init?: { status: number }): NextResponse;
  }
}

declare module 'next/link' {
  const Link: any;
  export default Link;
}

declare module 'next/navigation' {
  const useRouter: any;
  export { useRouter };
}

declare module 'next/image' {
  const Image: any;
  export default Image;
}

// Add more Next.js module declarations as needed