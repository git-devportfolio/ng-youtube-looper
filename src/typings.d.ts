// Global type definitions for ng-youtube-looper

// YouTube IFrame API types
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: typeof YT;
  }
}

// YouTube API namespace extension
declare namespace YT {
  interface Player {
    // Additional methods if needed
  }
  
  interface PlayerVars {
    // Additional player vars if needed
  }
}

// Module declarations for assets
declare module '*.svg' {
  const content: any;
  export default content;
}

declare module '*.png' {
  const content: any;
  export default content;
}

declare module '*.jpg' {
  const content: any;
  export default content;
}

export {};