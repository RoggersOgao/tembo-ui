
import clsx from 'clsx'
import React from 'react'

type Props = {
  children:React.ReactNode
  className?: string
}

function Container({children, className}: Props) {
  return (
    <div className={clsx('mx-auto max-w-400', className)}>{children}</div>
  )
}

export default Container