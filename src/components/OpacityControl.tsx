import React, { useEffect, useState, useCallback } from 'react';
import styled from '@emotion/styled';
import { Button } from '../core-components/Button';

const OpacityBox = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
`;

const Meter = styled.div`
  min-width: 140px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Bar = styled.div<{ value: number }>`
  position: relative;
  flex: 1;
  height: 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--color-text-secondary) 25%, transparent);
  overflow: hidden;
  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: ${({ value }) => `${Math.round(value * 100)}%`};
    background: var(--color-primary);
  }
`;

const Label = styled.span`
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
`;

export const OpacityControl: React.FC = () => {
  const [value, setValue] = useState(1);
  const [min, setMin] = useState(0.2);
  const [max, setMax] = useState(1);
  const [step, setStep] = useState(0.1);

  const refresh = useCallback(async () => {
    try {
      const res = await (window as any)?.electronAPI?.getOpacity?.();
      if (res) {
        setValue(res.value);
        setMin(res.min);
        setMax(res.max);
        setStep(res.step);
      }
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const handler = (payload: any) => {
      if (payload?.value != null) setValue(payload.value);
      if (payload?.min != null) setMin(payload.min);
      if (payload?.max != null) setMax(payload.max);
      if (payload?.step != null) setStep(payload.step);
    };
    (window as any)?.electronAPI?.onOpacityUpdated?.(handler);
    return () => (window as any)?.electronAPI?.removeOpacityListener?.();
  }, [refresh]);

  const decrease = async () => {
    await (window as any)?.electronAPI?.decreaseOpacity?.();
  };
  const increase = async () => {
    await (window as any)?.electronAPI?.increaseOpacity?.();
  };

  return (
    <OpacityBox>
      <Button size="small" variant="outlined" onClick={decrease}>Transparent −</Button>
      <Meter>
        <Bar value={value} />
        <Label>{Math.round(value * 100)}% (min {Math.round(min * 100)}%, max {Math.round(max * 100)}%)</Label>
      </Meter>
      <Button size="small" variant="outlined" onClick={increase}>Transparent +</Button>
    </OpacityBox>
  );
};



