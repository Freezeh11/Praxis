/**
 * Registry mapping a lawId to its animation component.
 *
 * Entries are kept in the same order and with the exact same predicates as the
 * original inline dispatcher: prefix rules for 'demorgan*' and 'annulment*',
 * exact matches for the rest. A lawId with no matching entry (e.g.
 * 'distributive-expand') resolves to null, so the host renders only its empty
 * container.
 */
import DeMorganSplitAnimation from './DeMorganSplitAnimation.jsx'
import DistributiveFactoringAnimation from './DistributiveFactoringAnimation.jsx'
import DoubleNegationAnimation from './DoubleNegationAnimation.jsx'
import AbsorptionAnimation from './AbsorptionAnimation.jsx'
import ComplementBurstAnimation from './ComplementBurstAnimation.jsx'
import AnnulmentAnimation from './AnnulmentAnimation.jsx'
import IdempotentAnimation from './IdempotentAnimation.jsx'
import IdentityAnimation from './IdentityAnimation.jsx'

const LAW_ANIMATIONS = [
  { matches: lawId => lawId.startsWith('demorgan'), animation: DeMorganSplitAnimation },
  { matches: lawId => lawId === 'distributive', animation: DistributiveFactoringAnimation },
  { matches: lawId => lawId === 'double-neg', animation: DoubleNegationAnimation },
  { matches: lawId => lawId === 'absorption', animation: AbsorptionAnimation },
  { matches: lawId => lawId === 'complement', animation: ComplementBurstAnimation },
  { matches: lawId => lawId.startsWith('annulment'), animation: AnnulmentAnimation },
  { matches: lawId => lawId === 'idempotent', animation: IdempotentAnimation },
  { matches: lawId => lawId === 'identity', animation: IdentityAnimation },
]

export function resolveLawAnimation(lawId) {
  const entry = LAW_ANIMATIONS.find(({ matches }) => matches(lawId))
  return entry ? entry.animation : null
}
