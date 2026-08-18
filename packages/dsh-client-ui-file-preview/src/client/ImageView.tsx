/**
 * Single-image preview with zoom / pan. One `<img>` node with a GPU-composited
 * `transform`, so viewing and zooming stay smooth (no reflow of a large DOM).
 * @module @undeadsheep/dsh-client-ui-file-preview/client/ImageView
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import cssModule from './FilePreviewWindow.module.css'

export interface ImageViewProps {
  url: string
  name: string
}

function clampScale(scale: number): number {
  return Math.min(Math.max(scale, 0.05), 40)
}

export function ImageView({ url, name }: ImageViewProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [fitScale, setFitScale] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const dragRef = useRef<null | {
    pointerId: number
    startX: number
    startY: number
    panX: number
    panY: number
  }>(null)

  const fit = useCallback(() => {
    const container = containerRef.current
    const img = imgRef.current
    if (!container || !img || img.naturalWidth === 0) return
    const s = Math.min(
      (container.clientWidth - 24) / img.naturalWidth,
      (container.clientHeight - 24) / img.naturalHeight,
      1,
    )
    const next = s > 0 ? s : 1
    setFitScale(next)
    setScale(next)
    setPan({ x: 0, y: 0 })
  }, [])

  const markLoaded = useCallback(() => {
    setLoaded(true)
    fit()
  }, [fit])

  // Fit when the image first loads and whenever the container resizes.
  useEffect(() => {
    setLoaded(false)
    const img = imgRef.current
    // Data: URLs may already be decoded before React attaches onLoad — check
    // img.complete so the preview doesn't stay blank on the first open.
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true)
      fit()
    }
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fit)
    observer.observe(container)
    return () => observer.disconnect()
  }, [fit, url])

  function zoomBy(factor: number): void {
    setScale(s => clampScale(s * factor))
  }

  function reset(): void {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  // Native wheel: React's onWheel is passive, so preventDefault would not stick
  // and the page behind the overlay would keep scrolling.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      setScale(s => clampScale(s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function onPointerDown(e: React.PointerEvent): void {
    if (scale <= fitScale) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
  }

  function onPointerMove(e: React.PointerEvent): void {
    const d = dragRef.current
    if (!d || e.pointerId !== d.pointerId) return
    setPan({ x: d.panX + (e.clientX - d.startX), y: d.panY + (e.clientY - d.startY) })
  }

  function onPointerUp(e: React.PointerEvent): void {
    if (dragRef.current && e.pointerId === dragRef.current.pointerId) dragRef.current = null
  }

  return (
    <div
      ref={containerRef}
      className={cssModule.imageView}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {!loaded && <div className={cssModule.imageLoading}>加载中…</div>}
      <img
        ref={imgRef}
        src={url}
        alt={name}
        draggable={false}
        onLoad={markLoaded}
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, opacity: loaded ? 1 : 0 }}
      />
      <div className={cssModule.imageToolbar}>
        <button type="button" onClick={() => zoomBy(1.25)} title="放大">＋</button>
        <button type="button" onClick={() => zoomBy(0.8)} title="缩小">－</button>
        <button type="button" onClick={reset} title="实际大小">1:1</button>
        <button type="button" onClick={fit} title="适应窗口">适应</button>
      </div>
    </div>
  )
}
