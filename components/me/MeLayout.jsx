'use client'

import { useState } from 'react'
import { T, F } from '@/lib/constants'
import TasteFileView from './TasteFileView'
import ProfileView from './ProfileView'

export default function MeLayout() {
  const [activeTab, setActiveTab] = useState('taste')

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 20px' }}>
      {/* Segmented control */}
      <div style={{
        display: 'flex',
        background: T.bg2,
        border: '1px solid ' + T.s,
        borderRadius: 10,
        padding: 3,
        marginTop: 20,
        marginBottom: 24,
      }}>
        <button
          onClick={() => setActiveTab('taste')}
          style={{
            flex: 1,
            textAlign: 'center',
            background: activeTab === 'taste' ? T.s : 'transparent',
            color: activeTab === 'taste' ? T.ink : T.ink3,
            boxShadow: activeTab === 'taste' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
            borderRadius: 8,
            padding: '8px 0',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: F,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Taste File
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            flex: 1,
            textAlign: 'center',
            background: activeTab === 'profile' ? T.s : 'transparent',
            color: activeTab === 'profile' ? T.ink : T.ink3,
            boxShadow: activeTab === 'profile' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
            borderRadius: 8,
            padding: '8px 0',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: F,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Public Profile
        </button>
      </div>

      {activeTab === 'profile' ? (
        <ProfileView />
      ) : (
        <TasteFileView />
      )}
    </div>
  )
}
