import type { ReactNode } from 'react'

interface TabItem {
  title: string
  content: ReactNode
}

interface CustomTabProps {
  tabs: TabItem[]
  activeTab: number
  setActiveTab: (i: number) => void
}

const CustomTab = ({ tabs, activeTab, setActiveTab }: CustomTabProps) => {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex relative border-b border-secondary-light">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`flex-1 py-3.5 text-center cursor-pointer transition-colors ${activeTab === i
              ? 'bg-secondary text-light text-lg font-semibold'
              : 'bg-secondary-light text-light/70'
              }`}
          >
            {tab.title}
          </button>
        ))}
        <div
          className="absolute bottom-0 left-0 bg-secondary-dark rounded-full transition-transform duration-300"
          style={{
            width: `calc(100% / ${tabs.length})`,
            height: '4px',
            transform: `translateX(${activeTab * 100}%)`,
          }}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {tabs[activeTab]?.content}
      </div>
    </div>
  )
}

export default CustomTab
