'use client';
import { useState } from 'react';
import { Button, Input, Chip, Tabs, Alert, Card } from '@/components/ui';
import { Search, AlertTriangle, Lightbulb } from 'lucide-react';
import styles from './design-showcase.module.css';

const PREFIX_CHIPS = ['전체', '공지', '후기', '질문', '잡담'];

export default function DesignSystemShowcase() {
  const [tab, setTab] = useState('button');
  const [selectedChip, setSelectedChip] = useState('전체');
  const [input1, setInput1] = useState('');
  const [input2, setInput2] = useState('');
  const [input3, setInput3] = useState('');

  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.title}>
          dokdokhae Design System
        </h1>
        <p className={styles.subtitle}>
          UI primitives showcase — Button / Input / Chip / Tabs / Alert / Card
        </p>
      </header>

      <Tabs
        ariaLabel="컴포넌트 카테고리"
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'button', label: 'Button' },
          { key: 'input', label: 'Input' },
          { key: 'chip', label: 'Chip' },
          { key: 'alert', label: 'Alert' },
          { key: 'card', label: 'Card' },
        ]}
      />

      {tab === 'button' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Button</h2>
          <div className={styles.row}>
            <Button onClick={() => alert('default click')}>기본 버튼</Button>
            <Button disabled>비활성</Button>
            <Button variant="disabled">disabled prop variant</Button>
          </div>
        </section>
      )}

      {tab === 'input' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Input</h2>
          <Input
            variant="outlined"
            placeholder="outlined input"
            value={input1}
            onChange={(e) => setInput1(e.target.value)}
          />
          <Input
            variant="filled"
            placeholder="filled input"
            value={input2}
            onChange={(e) => setInput2(e.target.value)}
          />
          <Input
            variant="elevated"
            placeholder="검색어를 입력하세요"
            value={input3}
            onChange={(e) => setInput3(e.target.value)}
            icon={<span aria-label="검색"><Search size={16} /></span>}
          />
        </section>
      )}

      {tab === 'chip' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Chip</h2>
          <p className={styles.caption}>
            선택된 칩은 primary 컬러로 표시됩니다.
          </p>
          <div className={styles.chipRow}>
            {PREFIX_CHIPS.map((c) => (
              <Chip
                key={c}
                selected={selectedChip === c}
                onClick={() => setSelectedChip(c)}
              >
                {c}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {tab === 'alert' && (
        <section className={styles.sectionTight}>
          <h2 className={styles.sectionTitle}>Alert</h2>
          <Alert variant="default" icon={<span>ℹ️</span>}>
            기본 알림 메시지입니다.
          </Alert>
          <Alert variant="warning" icon={<span><AlertTriangle size={16} /></span>}>
            주의 — 좌측 4px primary 보더로 강조됩니다.
          </Alert>
          <Alert variant="info" icon={<span><Lightbulb size={16} /></span>}>
            정보 안내 메시지입니다.
          </Alert>
        </section>
      )}

      {tab === 'card' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Card</h2>
          <div className={styles.cardGrid}>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <Card.Image />
                <Card.Text width="80%" />
                <Card.Text width="60%" />
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
