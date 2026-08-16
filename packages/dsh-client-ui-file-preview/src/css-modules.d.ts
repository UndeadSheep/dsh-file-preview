declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.css'

declare module '*.woff2' {
  const url: string
  export default url
}

declare module '*.woff' {
  const url: string
  export default url
}

declare module '*.ttf' {
  const url: string
  export default url
}
