'use client'
import { Suspense } from 'react'
import VisitorProfile from '@/components/visitor/VisitorProfile'
export default function VisitorProfilePage() { return <Suspense fallback={null}><VisitorProfile mode="visitor" /></Suspense> }
