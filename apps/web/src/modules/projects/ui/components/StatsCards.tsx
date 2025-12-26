"use client";

interface StatCardProps {
  label: string;
  value: string | number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div 
      className="dark:bg-[#0F1613] border"
      style={{ 
        backgroundColor: '#FFFFFF',
        flex: 1,
        minWidth: 0,
        height: '99px',
        borderRadius: '12px',
        borderWidth: '1px',
        borderColor: '#E7E5E4',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      <p 
        className="uppercase"
        style={{
          fontFamily: 'Inter',
          fontWeight: 400,
          fontSize: '12px',
          lineHeight: '150%',
          letterSpacing: '0.04em',
          textAlign: 'left',
          color: '#9CA3AF',
          whiteSpace: 'nowrap'
        }}
      >
        {label}
      </p>
      <p 
        style={{
          height: '29px',
          fontFamily: 'Inter',
          fontWeight: 700,
          fontSize: '24px',
          lineHeight: '29px',
          color: '#000000'
        }}
      >
        {value}
      </p>
    </div>
  );
}

interface StatsCardsProps {
  totalUsers?: number;
  apiCalls?: number;
  functions?: number;
}

export function StatsCards({ 
  totalUsers = 1284, 
  apiCalls = 45200,
  functions = 8 
}: StatsCardsProps) {
  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  return (
    <div 
      className="rounded-2xl bg-[#F3F3EE] dark:bg-[#1A2421]" 
      style={{ 
        padding: '12px',
        overflow: 'visible'
      }}
    >
      <div style={{ display: 'flex', gap: '16px' }}>
        <StatCard label="Total Users" value={formatNumber(totalUsers)} />
        <StatCard label="API Calls" value={formatNumber(apiCalls)} />
        <StatCard label="API Calls" value={formatNumber(apiCalls)} />
        <StatCard label="Functions" value={functions} />
      </div>
    </div>
  );
}
