/**
 * Curated dictionary of common tech/skill terms used to extract keywords from
 * bullet text when composing an Entry's semantic representation (architecture.md §4).
 * Not exhaustive by design — it's a heuristic signal, not a taxonomy.
 */
export const CURATED_SKILL_DICTIONARY: string[] = [
  // Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'C', 'Go', 'Rust', 'Swift',
  'Kotlin', 'Ruby', 'PHP', 'Scala', 'Perl', 'R', 'MATLAB', 'Objective-C', 'Dart', 'Haskell',
  'Elixir', 'Clojure', 'Bash', 'Shell', 'SQL', 'HTML', 'CSS', 'Sass', 'Less',

  // Frontend
  'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt.js', 'Redux', 'Zustand', 'jQuery',
  'Tailwind', 'Bootstrap', 'Webpack', 'Vite', 'Babel',

  // Backend / frameworks
  'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring', 'Spring Boot', 'Ruby on Rails',
  'ASP.NET', '.NET', 'Laravel', 'NestJS', 'GraphQL', 'REST', 'gRPC', 'WebSocket',

  // Data / ML
  'Machine Learning', 'Deep Learning', 'Neural Network', 'TensorFlow', 'PyTorch', 'scikit-learn',
  'Pandas', 'NumPy', 'Keras', 'NLP', 'Computer Vision', 'Data Science', 'Data Engineering',
  'ETL', 'Spark', 'Hadoop', 'Airflow', 'Kafka',

  // Databases
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Firestore', 'DynamoDB', 'Cassandra',
  'Elasticsearch', 'Snowflake', 'BigQuery',

  // Cloud / infra
  'AWS', 'Azure', 'GCP', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform', 'Ansible',
  'Jenkins', 'CI/CD', 'GitHub Actions', 'CircleCI', 'Serverless', 'Lambda', 'Nginx', 'Linux',

  // Tools / practices
  'Git', 'GitHub', 'GitLab', 'Jira', 'Agile', 'Scrum', 'Kanban', 'TDD', 'Unit Testing',
  'Microservices', 'API Design', 'System Design', 'OAuth', 'JWT',

  // Mobile
  'iOS', 'Android', 'React Native', 'Flutter', 'Xcode',
]
