import { useMemo, useRef, useState } from 'react'
import type { Material, WorkspaceItem } from '../types'

interface DragState { id: string; pointerId: number }

export function Workbench({
  items,
  materials,
  pending,
  selectedId,
  onSelect,
  onMove,
  onCombine,
  onDropMaterial,
}: {
  items: WorkspaceItem[]
  materials: Map<string, Material>
  pending: { x: number; y: number } | null
  selectedId: string | null
  onSelect: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
  onCombine: (firstId: string, secondId: string, x: number, y: number) => void
  onDropMaterial: (materialId: string, x: number, y: number) => void
}) {
  const surface = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  function coordinates(clientX: number, clientY: number): { x: number; y: number } {
    const bounds = surface.current?.getBoundingClientRect()
    if (!bounds) return { x: 50, y: 50 }
    return {
      x: Math.max(4, Math.min(92, ((clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(7, Math.min(88, ((clientY - bounds.top) / bounds.height) * 100)),
    }
  }

  function finishDrag(id: string, clientX: number, clientY: number): void {
    const position = coordinates(clientX, clientY)
    const target = items
      .filter((item) => item.id !== id)
      .map((item) => ({ item, distance: Math.hypot(item.x - position.x, item.y - position.y) }))
      .sort((a, b) => a.distance - b.distance)[0]
    if (target && target.distance < 12) onCombine(id, target.item.id, target.item.x, target.item.y)
    else onMove(id, position.x, position.y)
    drag.current = null
    setMoving(null)
  }

  return (
    <div
      ref={surface}
      className="workbench-surface"
      aria-label="Spatial crafting workbench"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const materialId = event.dataTransfer.getData('text/vectorcraft-material')
        if (materialId) {
          const point = coordinates(event.clientX, event.clientY)
          onDropMaterial(materialId, point.x, point.y)
        }
      }}
    >
      <div className="workbench-grid" aria-hidden="true" />
      {items.map((item) => {
        const material = materials.get(item.materialId)
        if (!material) return null
        return (
          <button
            key={item.id}
            type="button"
            className={`workbench-item ${selectedId === item.id ? 'selected' : ''} ${moving === item.id ? 'moving' : ''}`}
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            aria-label={`${material.name}, generation ${material.generation}. Drag onto another item to craft.`}
            onClick={() => onSelect(item.id)}
            onPointerDown={(event) => {
              drag.current = { id: item.id, pointerId: event.pointerId }
              setMoving(item.id)
              onSelect(item.id)
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              if (drag.current?.id !== item.id || drag.current.pointerId !== event.pointerId) return
              const point = coordinates(event.clientX, event.clientY)
              onMove(item.id, point.x, point.y)
            }}
            onPointerUp={(event) => {
              if (drag.current?.id === item.id) finishDrag(item.id, event.clientX, event.clientY)
            }}
            onPointerCancel={() => { drag.current = null; setMoving(null) }}
          >
            <span aria-hidden="true">{material.emoji}</span>
            <strong>{material.name}</strong>
            <small>G{material.generation}</small>
          </button>
        )
      })}
      {pending && <div className="workbench-pending" style={{ left: `${pending.x}%`, top: `${pending.y}%` }}><span>◇</span><strong>crafting…</strong></div>}
      {items.length === 0 && (
        <div className="workbench-empty">
          <span aria-hidden="true">✦</span>
          <strong>Your table is waiting.</strong>
          <p>Drag from the inventory, or tap an item and choose “Place.” Then drag discoveries together.</p>
        </div>
      )}
      <span className="sr-only">{itemMap.size} items on the workbench.</span>
    </div>
  )
}
