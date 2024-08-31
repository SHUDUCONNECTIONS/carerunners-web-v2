// Ignore TypeScript errors for all files
declare module '*';

// If you're using CSS modules and getting errors, add this:
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// If you're using image imports and getting errors, add these:
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.gif';