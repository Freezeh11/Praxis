// ─── Laws Reference ───────────────────────────────────────────────────────────
const LAWS = [
  { id: 'identity',       label: 'Identity Law',               forms: ['A + 0 = A', 'A · 1 = A'] },
  { id: 'null',           label: 'Null Law',                   forms: ['A + 1 = 1', 'A · 0 = 0'] },
  { id: 'idempotent',     label: 'Idempotent Law',             forms: ['A + A = A', 'A · A = A'] },
  { id: 'complement',     label: 'Complement Law',             forms: ["A + A' = 1", "A · A' = 0"] },
  { id: 'double_neg',     label: 'Double Negation',            forms: ["(A')' = A"] },
  { id: 'commutative',    label: 'Commutative Law',            forms: ['A + B = B + A', 'A · B = B · A'] },
  { id: 'associative',    label: 'Associative Law',            forms: ['(A+B)+C = A+(B+C)', '(A·B)·C = A·(B·C)'] },
  { id: 'distributive',   label: 'Distributive Law',           forms: ['A(B+C) = AB + AC', 'AB + AC = A(B+C)'] },
  { id: 'absorption',     label: 'Absorption Law',             forms: ['A + AB = A', 'A(A+B) = A'] },
  { id: 'demorgan',       label: "De Morgan's Law",            forms: ["(AB)' = A' + B'", "(A+B)' = A'B'"] },
];

// ─── Problem Bank ─────────────────────────────────────────────────────────────
const PROBLEMS = [

  // ── TIER 1: Single-step ──────────────────────────────────────────────────
  {
    id: 't1_01', tier: 1, title: 'Engine Ignition',
    scenario: "The ship's engine (A) requires the master key to be inserted (1). Simplify the ignition circuit so we can launch!",
    expr: 'A*1', answer: 'A',
    solution: [{ expr: 'A', law: 'identity', note: 'A · 1 = A' }],
    hints: ['Identity Law: Anything ANDed with 1 stays unchanged.']
  },
  {
    id: 't1_02', tier: 1, title: 'Airlock Status',
    scenario: "The inner airlock door is trying to open, but the outer door sensor is completely dead (0). Clear the redundant sensor!",
    expr: 'A+0', answer: 'A',
    solution: [{ expr: 'A', law: 'identity', note: 'A + 0 = A' }],
    hints: ['Identity Law: Adding 0 changes nothing.']
  },
  {
    id: 't1_03', tier: 1, title: 'Power Drain',
    scenario: "We have a severe power leak! The main reactor (A) is wired to a blown fuse (0). What's the output of this circuit?",
    expr: 'A*0', answer: '0',
    solution: [{ expr: '0', law: 'null', note: 'A · 0 = 0' }],
    hints: ['Null Law: Zero dominates AND.']
  },
  {
    id: 't1_04', tier: 1, title: 'Emergency Override',
    scenario: "Warning! The self-destruct is wired to a physical override switch that is permanently jammed ON (1). What's the output?",
    expr: 'A+1', answer: '1',
    solution: [{ expr: '1', law: 'null', note: 'A + 1 = 1' }],
    hints: ['Null Law: One dominates OR.']
  },
  {
    id: 't1_05', tier: 1, title: 'Echoing Comms',
    scenario: "Our distress signal (A) is being broadcast twice on the same channel, causing massive static. Merge the signals!",
    expr: 'A+A', answer: 'A',
    solution: [{ expr: 'A', law: 'idempotent', note: 'A + A = A' }],
    hints: ['Idempotent Law: What happens when you OR something with itself?']
  },
  {
    id: 't1_06', tier: 1, title: 'Flipped Wires',
    scenario: "The intern plugged the NOT gate backwards into another NOT gate! Fix the camera feed (A).",
    expr: "A''", answer: 'A',
    solution: [{ expr: 'A', law: 'double_neg', note: "(A')' = A" }],
    hints: ['Two NOTs cancel each other out.']
  },

  // ── TIER 2: Two–three steps ──────────────────────────────────────────────
  {
    id: 't2_01', tier: 2, title: 'Paradox Drive',
    scenario: "The hyper-drive is receiving a command to Go (A) and NOT Go (A') at the same time through an OR gate. What is the total state?",
    expr: "A+A'", answer: '1',
    solution: [{ expr: '1', law: 'complement', note: "A + A' = 1" }],
    hints: ["Complement Law: A + A' always equals 1."]
  },
  {
    id: 't2_02', tier: 2, title: 'Quantum Lock',
    scenario: "The vault door will only open if a particle is observed (A) AND simultaneously NOT observed (A'). Simplify this impossibility.",
    expr: "A*A'", answer: '0',
    solution: [{ expr: '0', law: 'complement', note: "A · A' = 0" }],
    hints: ["Complement Law: A variable ANDed with its own complement is 0."]
  },
  {
    id: 't2_03', tier: 2, title: 'Reboot Sequence',
    scenario: "The AI core reboot requires fixing this tangled mess of double negatives tied to the master switch (1).",
    expr: "A''*1", answer: 'A',
    solution: [
      { expr: 'A*1', law: 'double_neg',  note: "(A')' = A" },
      { expr: 'A',   law: 'identity',    note: 'A · 1 = A' }
    ],
    hints: ['Start with the double complement on A.', 'After removing the double negation you get A·1.']
  },
  {
    id: 't2_04', tier: 2, title: 'Junk Data Cleanup',
    scenario: "The telemetry stream is full of junk data. We have duplicate signals and dead sensors (0). Clean it up!",
    expr: 'A+A+A*0', answer: 'A',
    solution: [
      { expr: 'A+A+0', law: 'null',       note: 'A · 0 = 0' },
      { expr: 'A+0',   law: 'idempotent', note: 'A + A = A' },
      { expr: 'A',     law: 'identity',   note: 'A + 0 = A' }
    ],
    hints: ['Apply Null Law to the A·0 part first.', "After Null Law you'll have A+A+0. Then Idempotent."]
  },

  // ── TIER 3: Factor & Reduce ──────────────────────────────────────────────
  {
    id: 't3_01', tier: 3, title: 'Robo-Pathfinder',
    scenario: "The rover's navigation logic is splitting its processing power. Factor out the common variable to speed up its CPU!",
    expr: "AB+AB'", answer: 'A',
    solution: [
      { expr: "A(B+B')", law: 'distributive', note: 'AB + AB\' = A(B+B\')' },
      { expr: 'A*1',     law: 'complement',   note: "B + B' = 1" },
      { expr: 'A',       law: 'identity',     note: 'A · 1 = A' }
    ],
    hints: ['Both terms share the same leading variable. Try factoring it out.']
  },
  {
    id: 't3_02', tier: 3, title: 'Shield Calibration',
    scenario: "The deflector shields are locked in a useless loop testing the frequency (B) against its inverse. Simplify the bracketed logic.",
    expr: "A*(B+B')", answer: 'A',
    solution: [
      { expr: 'A*1', law: 'complement', note: "B + B' = 1" },
      { expr: 'A',   law: 'identity',   note: 'A · 1 = A' }
    ],
    hints: ["Look inside the brackets. B + B' matches the Complement Law."]
  },
  {
    id: 't3_03', tier: 3, title: 'Anti-Matter Leak',
    scenario: "An anti-matter variable (A') collided with regular matter (A) in the logic stream! Resolve the paradox before the core melts.",
    expr: "A'*A+A*B", answer: 'AB',
    solution: [
      { expr: "0+AB", law: 'complement', note: "A' · A = 0" },
      { expr: 'AB',   law: 'identity',   note: '0 + AB = AB' }
    ],
    hints: ["A' · A = 0 by Complement Law. Replace that term."]
  },

  // ── TIER 4: Absorption ───────────────────────────────────────────────────
  {
    id: 't4_01', tier: 4, title: 'Redundant Sensors',
    scenario: "Camera A is watching the hallway. Camera B only turns on if Camera A is already on. This is a waste of power! Optimize it.",
    expr: 'A+AB', answer: 'A',
    solution: [{ expr: 'A', law: 'absorption', note: 'A + AB = A' }],
    hints: ['Absorption Law: The longer term is redundant.']
  },
  {
    id: 't4_02', tier: 4, title: 'Logic Loophole',
    scenario: "The firewall is checking condition A outside the loop, and then checking it again inside! Absorb the redundant check.",
    expr: 'A*(A+B)', answer: 'A',
    solution: [{ expr: 'A', law: 'absorption', note: 'A(A+B) = A' }],
    hints: ['A appears both outside the brackets and inside.']
  },

  // ── TIER 5: De Morgan's ──────────────────────────────────────────────────
  {
    id: 't5_01', tier: 5, title: 'Encrypted Transmission',
    scenario: "We intercepted an alien transmission, but the whole message is wrapped in an inversion field. Break the encryption!",
    expr: "(AB)'", answer: "A'+B'",
    solution: [{ expr: "A'+B'", law: 'demorgan', note: "(AB)' = A'+B'" }],
    hints: ["De Morgan's AND form: Break the bar and flip AND to OR."]
  },
  {
    id: 't5_02', tier: 5, title: 'Inverted Comms',
    scenario: "The comms array is broadcasting a massive inverted OR signal. Split the signal into its individual negative components.",
    expr: "(A+B)'", answer: "A'*B'",
    solution: [{ expr: "A'*B'", law: 'demorgan', note: "(A+B)' = A'B'" }],
    hints: ["De Morgan's OR form: Break the bar and flip OR to AND."]
  },

  // ── TIER 6: Boss Level ───────────────────────────────────────────────────
  {
    id: 't6_01', tier: 6, title: 'The Rogue AI Core',
    scenario: "The rogue AI has locked the doors with a massive logic maze! You need to chain multiple simplifications to break through.",
    expr: "AB+A'B", answer: 'B',
    solution: [
      { expr: "(A+A')B", law: 'distributive', note: 'Factor B' },
      { expr: '1*B',     law: 'complement',   note: "A+A'=1" },
      { expr: 'B',       law: 'identity',     note: '1·B = B' }
    ],
    hints: ['Factor out B: AB + A\'B = B(A + A\').']
  },
  {
    id: 't6_02', tier: 6, title: 'Master Override',
    scenario: "This is the final lock. Four interconnected variables are blocking the mainframe. Factor them down to their pure essence!",
    expr: "AB+AC+A'B+A'C", answer: 'B+C',
    solution: [
      { expr: "A(B+C)+A'(B+C)", law: 'distributive', note: 'Factor A and A\'' },
      { expr: "(A+A')(B+C)",    law: 'distributive', note: 'Factor (B+C)' },
      { expr: '1*(B+C)',        law: 'complement',   note: "A+A'=1" },
      { expr: 'B+C',            law: 'identity',     note: '1·(B+C) = B+C' }
    ],
    hints: ['Factor A from the first two and A\' from the last two.']
  }
];

function getProblemsByTier(tier) { return PROBLEMS.filter(p => p.tier === tier); }
function getProblemById(id) { return PROBLEMS.find(p => p.id === id) || null; }

const TIER_INFO = [
  { tier: 1, name: 'Basic Wiring',      color: '#1cb0f6', desc: 'Fix simple broken circuits.' },
  { tier: 2, name: 'Reboot Systems',    color: '#ff9600', desc: 'Clean up bad data and paradoxes.' },
  { tier: 3, name: 'CPU Optimization',  color: '#ce82ff', desc: 'Factor out redundant code.' },
  { tier: 4, name: 'Sensor Sweep',      color: '#ff4b4b', desc: 'Absorb useless firewall checks.' },
  { tier: 5, name: 'Alien Crypto',      color: '#a855f7', desc: "Crack inverted encryption." },
  { tier: 6, name: 'The Mainframe',     color: '#58cc02', desc: 'Override the Rogue AI.' },
];
