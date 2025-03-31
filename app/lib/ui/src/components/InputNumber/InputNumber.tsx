import { useEffect, useRef, useState } from 'react'
import { useNumberField } from 'react-aria'
import { useNumberFieldState } from 'react-stately'

import './InputNumber.css'

export interface InputNumberProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  children?: React.ReactNode
  className?: string
  showSlider?: boolean
  formatOptions?: Intl.NumberFormatOptions
}

export const InputNumber = ({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  disabled = false,
  children,
  className = '',
  showSlider = true,
  formatOptions,
}: InputNumberProps) => {
  const [dragging, setDragging] = useState(false)
  const [sliderRef, setSliderRef] = useState<HTMLDivElement | null>(null)
  const [dragStart, setDragStart] = useState<{
    x: number
    value: number
    bounds: DOMRect | null
  } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  const numberFieldState = useNumberFieldState({
    value,
    onChange: (val) => {
      if (val !== null) {
        onChange(clampValue(val))
      }
    },
    minValue: min !== -Infinity ? min : undefined,
    maxValue: max !== Infinity ? max : undefined,
    step,
    isDisabled: disabled,
    locale: 'en-US',
    formatOptions,
  })

  const { inputProps, labelProps } = useNumberField(
    {
      minValue: min !== -Infinity ? min : undefined,
      maxValue: max !== Infinity ? max : undefined,
      step,
      isDisabled: disabled,
      'aria-label': typeof children === 'string' ? children : 'Number input',
      formatOptions,
    },
    numberFieldState,
    inputRef,
  )

  const startDrag = (e: React.MouseEvent | MouseEvent) => {
    if (!disabled && sliderRef) {
      const bounds = sliderRef.getBoundingClientRect()
      // First update the value based on click position
      const clickX = e.clientX - bounds.left
      const percentage = clickX / bounds.width
      const newValue = min + (max - min) * percentage
      const clampedValue = clampValue(newValue)
      onChange(clampedValue)

      // Then start dragging from this new position
      setDragging(true)
      setDragStart({ x: e.clientX, value: clampedValue, bounds })

      // Add the dragging class to body for styling
      document.body.classList.add('dragging')

      // Prevent default to avoid text selection
      e.preventDefault()
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (dragging && dragStart?.bounds) {
      const bounds = dragStart.bounds
      const containerWidth = bounds.width
      const dx = e.clientX - dragStart.x
      const percentageMoved = dx / containerWidth
      const valueRange = max - min
      const valueDelta = valueRange * percentageMoved
      const multiplier = e.shiftKey ? 0.1 : 1 // Shift for finer control
      const newValue = dragStart.value + valueDelta * multiplier

      // Only update if the value has actually changed
      if (newValue !== value) {
        onChange(clampValue(newValue))
      }
    }
  }

  const handleMouseUp = () => {
    setDragging(false)
    setDragStart(null)

    // Remove the dragging class from body
    document.body.classList.remove('dragging')
  }

  const clampValue = (val: number) => {
    // Round to step precision
    const rounded = Math.round(val / step) * step

    // Apply min/max constraints
    return Math.min(max, Math.max(min, rounded))
  }

  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, dragStart, value])

  const hasRange = max !== Infinity && min !== -Infinity
  const percentage = hasRange
    ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
    : 0

  return (
    <div className={`ui-number ${className}`.trim()}>
      {children && (
        <label className="ui-number__label" {...labelProps}>
          {children}
        </label>
      )}
      <div
        className={`ui-number__container ${
          hasRange && showSlider ? 'ui-number__container--has-range' : ''
        }`}
      >
        {hasRange && showSlider && (
          <div
            ref={setSliderRef}
            className="ui-number__slider-container"
            onMouseDown={startDrag}
          >
            <div className="ui-number__bar">
              <div className="ui-number__fill" style={{ width: `${percentage}%` }} />
            </div>
            <div
              className="ui-number__scrubber"
              style={{ '--percentage': percentage / 100 } as React.CSSProperties}
            />
          </div>
        )}
        <input {...inputProps} ref={inputRef} className="ui-number__input" />
      </div>
    </div>
  )
}
