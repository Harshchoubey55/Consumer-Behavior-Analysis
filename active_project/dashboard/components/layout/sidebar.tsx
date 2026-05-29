'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const nav = [
  { href: '/',                label: 'Overview',        icon: '◈', section: null,          novel: false },
  { href: '/funnel',          label: 'Funnel',           icon: '⌥', section: null,          novel: false },
  { href: '/paths',           label: 'Behavior Paths',   icon: '⇢', section: null,          novel: false },
  { href: '/products',        label: 'Products',         icon: '◻', section: null,          novel: false },
  { href: '/sessions',        label: 'Sessions',         icon: '⊞', section: null,          novel: false },
  { href: '/context',         label: 'Decision Context', icon: '◑', section: 'RESEARCH',    novel: true  },
  { href: '/evaluation',      label: 'Model Evaluation', icon: '◎', section: null,          novel: true  },
  { href: '/interventions',   label: 'Interventions',    icon: '⚡', section: 'ADAPTIVE',   novel: true  },
  { href: '/predictions',     label: 'Predictions',      icon: '⊙', section: null,          novel: false },
  { href: '/recommendations', label: 'Insights',         icon: '◉', section: null,          novel: false },
  { href: '/phenotypes',      label: 'Behavioral Types', icon: '◆', section: 'INTELLIGENCE', novel: true  },
  { href: '/anomalies',       label: 'Anomalies',        icon: '⚠', section: null,          novel: true  },
  { href: '/agents',          label: 'Agent Health',     icon: '⬡', section: null,          novel: true  },
];
export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside style={{ width:220,flexShrink:0,background:'rgba(15, 17, 23, 0.5)',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)',borderRight:'1px solid rgba(255, 255, 255, 0.05)',display:'flex',flexDirection:'column',position:'sticky',top:0,height:'100vh',overflow:'hidden',zIndex:50 }}>
      <div style={{ padding:'24px 20px 20px',borderBottom:'1px solid var(--border)' }}>
        <div className="font-display" style={{ fontSize:18,fontWeight:800,letterSpacing:'-0.02em',color:'var(--text-primary)' }}>
          Behavior<span style={{ color:'var(--accent-blue)' }}>Lens</span>
        </div>
        <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:4,fontFamily:'DM Mono',letterSpacing:'0.08em' }}>ANALYTICS v3.0</div>
      </div>
      <nav style={{ flex:1,padding:'16px 12px',display:'flex',flexDirection:'column',gap:2,overflowY:'auto' }}>
        <div style={{ fontSize:10,color:'var(--text-muted)',letterSpacing:'0.12em',padding:'4px 8px 8px',fontFamily:'DM Mono' }}>ANALYTICS</div>
        {nav.map((item) => {
          const active = pathname === item.href;
          const accentColor = item.novel ? '#f59e0b' : 'var(--accent-blue)';
          return (
            <div key={item.href}>
              {item.section && (
                <div style={{ fontSize:9,color:'#f59e0b',letterSpacing:'0.14em',padding:'10px 8px 4px',fontFamily:'DM Mono',borderTop:'1px solid var(--border)',marginTop:6 }}>
                  {item.section}
                </div>
              )}
              <Link href={item.href} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,fontSize:13,fontFamily:'DM Mono',textDecoration:'none',transition:'all 0.15s',background:active?(item.novel?'rgba(245,158,11,0.12)':'rgba(79,142,247,0.12)'):'transparent',color:active?accentColor:(item.novel?'rgba(245,158,11,0.7)':'var(--text-secondary)'),border:active?`1px solid ${item.novel?'rgba(245,158,11,0.25)':'rgba(79,142,247,0.2)'}`:'1px solid transparent' }}>
                <span style={{ fontSize:14,opacity:active?1:0.6 }}>{item.icon}</span>
                {item.label}
                {item.novel && !active && (
                  <span style={{ marginLeft:'auto',fontSize:9,fontFamily:'DM Mono',color:'#f59e0b',letterSpacing:'0.06em',background:'rgba(245,158,11,0.1)',padding:'1px 6px',borderRadius:4,border:'1px solid rgba(245,158,11,0.2)' }}>NEW</span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>
      <div style={{ padding:'16px 20px',borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8 }}>
        <div style={{ width:6,height:6,borderRadius:'50%',background:'var(--accent-green)',boxShadow:'0 0 8px var(--accent-green)' }} />
        <span style={{ fontSize:11,color:'var(--text-muted)',fontFamily:'DM Mono',letterSpacing:'0.06em' }}>LIVE DATA</span>
      </div>
    </aside>
  );
}
