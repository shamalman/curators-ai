"use client"
import { Suspense } from "react"
import VisitorProfile from "@/components/visitor/VisitorProfile"
export default function ProfileView() { return <Suspense fallback={null}><VisitorProfile mode="curator" /></Suspense> }
