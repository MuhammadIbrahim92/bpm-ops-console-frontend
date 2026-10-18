import { conditionVariables, evaluateCondition } from './index';

describe('conditions on an arrow', () => {
  it('lists the variables a condition reads, once each', () => {
    expect(conditionVariables('[Approved]="Approval" & [Status]!="x" | [Approved]="y"')).toEqual(['Approved', 'Status']);
    expect(conditionVariables('1=1')).toEqual([]);
  });

  it('works out whether a condition holds for the instance values', () => {
    expect(evaluateCondition('[Approved]="Approval"', { Approved: 'Approval' })).toBeTrue();
    expect(evaluateCondition('[Approved]="Approval"', { Approved: 'Rejected' })).toBeFalse();
    expect(evaluateCondition('[A]="1" & [B]="2"', { A: '1', B: '3' })).toBeFalse();
    expect(evaluateCondition('[A]="1" | [B]="2"', { A: '0', B: '2' })).toBeTrue();
    expect(evaluateCondition('[Count]>3', { Count: '5' })).toBeTrue();
  });

  it('treats a variable with no value as null, like the simulator', () => {
    expect(evaluateCondition('[Missing]="null"', {})).toBeTrue();
    expect(evaluateCondition('[Missing]="x"', {})).toBeFalse();
  });

  it('gives null for text it cannot read', () => {
    expect(evaluateCondition('[Approved]="Approval', { Approved: 'x' })).toBeNull();
  });
});
