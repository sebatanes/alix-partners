const firstNames = [ 'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Susan', 'Richard', 'Jessica', 'Joseph', 'Sarah', 'Thomas', 'Karen', 'Charles', 'Nancy', 'Christopher', 'Lisa', 'Daniel', 'Margaret', 'Matthew', 'Betty', 'Anthony', 'Sandra', 'Mark', 'Ashley', 'Donald', 'Kimberly', 'Steven', 'Emily', 'Paul', 'Donna', 'Andrew', 'Michelle', 'Joshua', 'Dorothy' ];

const lastNames = [ 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores' ];

const departments = [ 'Marketing', 'Sales', 'Engineering', 'Product', 'Operations', 'Finance', 'Human Resources', 'Legal', 'Customer Success', 'Research', 'Development', 'Strategy', 'Business Development', 'Quality Assurance', 'Information Technology' ];

const jobFunctions = [
  { jobFunctionId: 1, function: "Administration" },
  { jobFunctionId: 2, function: "Logistics and Fulfillment" },
  { jobFunctionId: 3, function: "Business and Financial Operations" },
  { jobFunctionId: 4, function: "Communications" },
  { jobFunctionId: 5, function: "Clinical Affairs" },
  { jobFunctionId: 6, function: "Marketing" },
  { jobFunctionId: 7, function: "Analytics" },
  { jobFunctionId: 8, function: "Medical and Regulatory Affairs" },
  { jobFunctionId: 9, function: "Legal and Compliance" },
  { jobFunctionId: 10, function: "Sales" },
  { jobFunctionId: 11, function: "Customer Success" },
  { jobFunctionId: 12, function: "Supply Chain" },
  { jobFunctionId: 13, function: "Manufacturing and Maintenance" },
  { jobFunctionId: 14, function: "Engineering and Science" },
  { jobFunctionId: 15, function: "Environmental Health and Safety" },
  { jobFunctionId: 16, function: "Facilities" },
  { jobFunctionId: 17, function: "Human Resources" },
  { jobFunctionId: 18, function: "Healthcare Provision - Patient Facing Clinical" },
  { jobFunctionId: 19, function: "Healthcare Provision - Non-Patient Facing Clinical" },
  { jobFunctionId: 20, function: "Information Technology" }
];

const titlesByLevel = [
  ['Chief Executive Officer (CEO)'],
  ['Chief Operating Officer (COO)', 'Chief Financial Officer (CFO)', 'Chief Technology Officer (CTO)', 'Chief Marketing Officer (CMO)', 'Chief Human Resources Officer (CHRO)'],
  ['VP of Engineering', 'VP of Sales', 'VP of Marketing', 'VP of Operations', 'VP of Product', 'VP of Finance'],
  ['Senior Director', 'Executive Director', 'Director'],
  ['Senior Manager', 'Manager', 'Product Manager', 'Engineering Manager'],
  ['Team Lead', 'Technical Lead', 'Project Lead'],
  ['Senior Engineer', 'Senior Developer', 'Principal Analyst'],
  ['Associate Engineer', 'Coordinator', 'Analyst', 'Staff Member'],
  ['Junior Staff', 'Assistant', 'Intern']
];

function generateRandomName() {
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${first} ${last}`;
}

function generateRandomId() {
  return Math.random().toString(36).substring(2, 15);
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getJobFunctionForDepartment(dept) {
  const matches = {
    'Marketing': 6,
    'Sales': 10,
    'Engineering': 14,
    'Product': 14,
    'Operations': 12,
    'Finance': 3,
    'Human Resources': 17,
    'Legal': 9,
    'Customer Success': 11,
    'Research': 14,
    'Development': 14,
    'Strategy': 3,
    'Business Development': 3,
    'Quality Assurance': 15,
    'Information Technology': 20
  };
  const id = matches[dept] || 1;
  return jobFunctions.find(j => j.jobFunctionId === id);
}

function generateHeadcountByLevel(level) {
  if (level <= 1) return { active: 1, inactive: 0, open: 0, total: 1 };
  const base = {
    2: [2, 1, 0],
    3: [5, 1, 1],
    4: [10, 2, 1],
    5: [15, 3, 2],
    6: [20, 4, 3],
    7: [30, 5, 5],
    8: [40, 8, 6]
  }[level] || [5, 1, 0];

  const [a, i, o] = base.map(n => Math.floor(Math.random() * n));
  return { active: a, inactive: i, open: o, total: a + i + o };
}

let totalNodes = 0;
const targetNodes = 10000;

function generateOrgNode(level = 0, maxLevel = 8) {
  if (totalNodes >= targetNodes) return null;

  const position = getRandomElement(titlesByLevel[level] || ['Employee']);
  const department = getRandomElement(departments);
  const jobFunction = getJobFunctionForDepartment(department);
  const headcount = generateHeadcountByLevel(level);

  const node = {
    id: generateRandomId(),
    name: generateRandomName(),
    position,
    department,
    jobFunction,
    headcount,
    level,
    isManagerial: level <= 5, 
    children: []
  };

  totalNodes++;

  if (level < maxLevel && totalNodes < targetNodes) {
    const minChildren = level < 2 ? 2 : 1;
    const maxChildren = level < 2 ? 4 : 6;

    const remainingNodes = targetNodes - totalNodes;
    const maxPossibleChildren = Math.min(maxChildren, Math.floor(remainingNodes / (maxLevel - level)));

    const numChildren = Math.floor(Math.random() * (maxPossibleChildren - minChildren + 1)) + minChildren;

    for (let i = 0; i < numChildren && totalNodes < targetNodes; i++) {
      const child = generateOrgNode(level + 1, maxLevel);
      if (child) node.children.push(child);
    }
  }

  return node;
}

export function generateOrganizationalChart() {
  totalNodes = 0;
  return generateOrgNode(0, 8);
}
