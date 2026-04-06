import type { NodeData, EdgeData } from '../types';
import { mapHierarchicalToSphere } from '../services/mapNodesToSphere';
import type { Lang } from '../i18n/translations';

interface RawNode {
  id: string;
  label: string;
  type: NodeData['type'];
  weight: number;
  description: string;
  parentId: string | null;
  abstractionLevel: string;
  facets?: { cognitive: string; epistemological: string; rhetorical: string };
}

const DEMO_NODES_KO: RawNode[] = [
  // D0: 루트 (1)
  { id: 'root', label: 'AI와 인간 사회', type: 'concept', weight: 1.0, description: 'AI가 인간 사회에 미치는 다층적 영향', parentId: null, abstractionLevel: 'superordinate' },

  // D1: 테마 (5)
  { id: 't1', label: '노동의 재편', type: 'concept', weight: 0.95, description: 'AI 자동화로 인한 직업 구조의 근본적 변화', parentId: 'root', abstractionLevel: 'superordinate' },
  { id: 't2', label: '인식론적 전환', type: 'philosophy', weight: 0.85, description: '지식 생산과 진실 판별 방식의 변화', parentId: 'root', abstractionLevel: 'superordinate' },
  { id: 't3', label: '윤리적 프레임워크', type: 'philosophy', weight: 0.78, description: 'AI 시대의 도덕적 판단 기준', parentId: 'root', abstractionLevel: 'superordinate' },
  { id: 't4', label: '사회적 불평등', type: 'context', weight: 0.65, description: 'AI 접근성과 수혜의 비대칭', parentId: 'root', abstractionLevel: 'superordinate' },
  { id: 't5', label: '창의성의 경계', type: 'abstraction', weight: 0.55, description: '인간 고유 영역으로서의 창의성 재정의', parentId: 'root', abstractionLevel: 'superordinate' },

  // D2: 기본개념 (20)
  { id: 'c1', label: '직무 자동화 스펙트럼', type: 'concept', weight: 0.92, description: '반복 업무부터 인지 업무까지의 자동화 범위', parentId: 't1', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'thesis' } },
  { id: 'c2', label: '인간-AI 협업 모델', type: 'concept', weight: 0.74, description: '보완적 협업 vs 대체 경쟁', parentId: 't1', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'theoretical', rhetorical: 'thesis' } },
  { id: 'c3', label: '재교육 인프라', type: 'context', weight: 0.45, description: '대규모 직업 전환을 위한 교육 시스템', parentId: 't1', abstractionLevel: 'basic', facets: { cognitive: 'context', epistemological: 'normative', rhetorical: 'warrant' } },
  { id: 'c4', label: '긱 경제 확산', type: 'nuance', weight: 0.32, description: 'AI로 가속화되는 비정규직화', parentId: 't1', abstractionLevel: 'basic', facets: { cognitive: 'nuance', epistemological: 'empirical', rhetorical: 'evidence' } },
  { id: 'c5', label: '딥페이크와 진실', type: 'concept', weight: 0.88, description: '합성 미디어가 진실 판별에 미치는 영향', parentId: 't2', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'thesis' } },
  { id: 'c6', label: 'LLM 환각 문제', type: 'concept', weight: 0.68, description: '언어 모델의 사실 왜곡 현상', parentId: 't2', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'antithesis' } },
  { id: 'c7', label: '집단 지성의 변형', type: 'abstraction', weight: 0.42, description: 'AI가 매개하는 새로운 지식 생산 방식', parentId: 't2', abstractionLevel: 'basic', facets: { cognitive: 'abstraction', epistemological: 'theoretical', rhetorical: 'thesis' } },
  { id: 'c8', label: '학술 무결성', type: 'context', weight: 0.28, description: 'AI 생성 논문과 연구 진정성', parentId: 't2', abstractionLevel: 'basic', facets: { cognitive: 'context', epistemological: 'normative', rhetorical: 'qualifier' } },
  { id: 'c9', label: '알고리즘 편향', type: 'concept', weight: 0.90, description: '학습 데이터에 내재된 차별의 재생산', parentId: 't3', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'evidence' } },
  { id: 'c10', label: '투명성 요구', type: 'philosophy', weight: 0.62, description: 'AI 의사결정의 설명가능성', parentId: 't3', abstractionLevel: 'basic', facets: { cognitive: 'philosophy', epistemological: 'normative', rhetorical: 'thesis' } },
  { id: 'c11', label: '자율 무기 윤리', type: 'mood', weight: 0.38, description: '치명적 자율 무기 시스템의 도덕적 딜레마', parentId: 't3', abstractionLevel: 'basic', facets: { cognitive: 'mood', epistemological: 'normative', rhetorical: 'antithesis' } },
  { id: 'c12', label: '프라이버시 침해', type: 'concept', weight: 0.82, description: '감시 자본주의와 개인정보', parentId: 't3', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'evidence' } },
  { id: 'c13', label: '디지털 디바이드', type: 'concept', weight: 0.72, description: 'AI 기술 접근 격차', parentId: 't4', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'thesis' } },
  { id: 'c14', label: '글로벌 남북 격차', type: 'context', weight: 0.48, description: 'AI 개발국과 비개발국의 비대칭', parentId: 't4', abstractionLevel: 'basic', facets: { cognitive: 'context', epistemological: 'empirical', rhetorical: 'evidence' } },
  { id: 'c15', label: '데이터 식민주의', type: 'nuance', weight: 0.35, description: '개발도상국 데이터 추출 구조', parentId: 't4', abstractionLevel: 'basic', facets: { cognitive: 'nuance', epistemological: 'theoretical', rhetorical: 'antithesis' } },
  { id: 'c16', label: '의료 AI 접근성', type: 'concept', weight: 0.22, description: '진단 AI의 보편적 접근 가능성', parentId: 't4', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'qualifier' } },
  { id: 'c17', label: '생성형 AI 예술', type: 'concept', weight: 0.58, description: 'AI가 만든 예술의 저작권과 가치', parentId: 't5', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'theoretical', rhetorical: 'thesis' } },
  { id: 'c18', label: '공동 창작 패러다임', type: 'abstraction', weight: 0.40, description: '인간-AI 합작의 새로운 창작 모델', parentId: 't5', abstractionLevel: 'basic', facets: { cognitive: 'abstraction', epistemological: 'theoretical', rhetorical: 'thesis' } },
  { id: 'c19', label: '문학의 기계화', type: 'mood', weight: 0.25, description: 'AI 서사 생성이 문학성에 미치는 영향', parentId: 't5', abstractionLevel: 'basic', facets: { cognitive: 'mood', epistemological: 'normative', rhetorical: 'antithesis' } },
  { id: 'c20', label: '음악 생성 알고리즘', type: 'concept', weight: 0.18, description: 'AI 작곡의 예술적 가치 논쟁', parentId: 't5', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'qualifier' } },

  // D3: 하위 (15)
  { id: 'd1', label: 'GPT-4 코딩 대체율 47%', type: 'concept', weight: 0.85, description: 'OpenAI 연구: 프로그래밍 작업 47% 자동화 가능', parentId: 'c1', abstractionLevel: 'subordinate' },
  { id: 'd2', label: '법률 문서 분석 자동화', type: 'concept', weight: 0.52, description: '계약서 검토 90% 시간 단축 사례', parentId: 'c1', abstractionLevel: 'subordinate' },
  { id: 'd3', label: 'Copilot 페어프로그래밍', type: 'concept', weight: 0.60, description: 'GitHub Copilot의 생산성 55% 향상 데이터', parentId: 'c2', abstractionLevel: 'instance' },
  { id: 'd4', label: '싱가포르 SkillsFuture', type: 'context', weight: 0.30, description: '국가 단위 AI 재교육 프로그램 모델', parentId: 'c3', abstractionLevel: 'instance' },
  { id: 'd5', label: '선거 딥페이크 사건', type: 'concept', weight: 0.80, description: '2024 미국 대선 AI 음성 합성 사건', parentId: 'c5', abstractionLevel: 'instance' },
  { id: 'd6', label: '학술 논문 AI 검출 오류', type: 'concept', weight: 0.24, description: 'GPTZero 위양성률 12% 문제', parentId: 'c8', abstractionLevel: 'subordinate' },
  { id: 'd7', label: 'COMPAS 재범 예측 편향', type: 'concept', weight: 0.78, description: '흑인 피고인 과대예측 사례', parentId: 'c9', abstractionLevel: 'instance' },
  { id: 'd8', label: 'EU AI법 고위험 분류', type: 'context', weight: 0.55, description: '유럽 AI 규제 프레임워크의 위험 등급', parentId: 'c10', abstractionLevel: 'subordinate' },
  { id: 'd9', label: 'Clearview AI 논란', type: 'concept', weight: 0.70, description: '무단 안면인식 데이터 수집 소송', parentId: 'c12', abstractionLevel: 'instance' },
  { id: 'd10', label: 'ChatGPT 접근 차단국', type: 'context', weight: 0.35, description: '이탈리아, 중국 등 접근 제한 사례', parentId: 'c13', abstractionLevel: 'instance' },
  { id: 'd11', label: 'Stability AI 저작권 소송', type: 'concept', weight: 0.50, description: 'Getty Images vs Stability AI 판례', parentId: 'c17', abstractionLevel: 'instance' },
  { id: 'd12', label: 'Suno AI 음원 저작권', type: 'concept', weight: 0.20, description: 'AI 생성 음악의 저작권 귀속 논쟁', parentId: 'c20', abstractionLevel: 'subordinate' },
  { id: 'd13', label: 'Amazon 채용 AI 폐기', type: 'concept', weight: 0.65, description: '성별 편향 채용 AI 폐기 사례', parentId: 'c9', abstractionLevel: 'instance' },
  { id: 'd14', label: 'Uber 긱워커 분류 판결', type: 'context', weight: 0.28, description: '영국 대법원 노동자 지위 인정', parentId: 'c4', abstractionLevel: 'instance' },
  { id: 'd15', label: 'PathAI 진단 정확도', type: 'concept', weight: 0.42, description: '병리 진단 AI의 96% 정확도 임상시험', parentId: 'c16', abstractionLevel: 'subordinate' },

  // D4: 인스턴스 (9)
  { id: 'e1', label: 'GPT-4 변호사 시험 상위 10%', type: 'concept', weight: 0.45, description: 'GPT-4의 미국 변호사 시험 성적', parentId: 'd2', abstractionLevel: 'instance' },
  { id: 'e2', label: '바이든 AI 음성 로보콜', type: 'concept', weight: 0.75, description: '2024년 뉴햄프셔 프라이머리 AI 음성 사건', parentId: 'd5', abstractionLevel: 'instance' },
  { id: 'e3', label: 'ProPublica COMPAS 보고서', type: 'concept', weight: 0.68, description: '2016년 재범예측 인종차별 탐사보도', parentId: 'd7', abstractionLevel: 'instance' },
  { id: 'e4', label: 'EU AI법 2024.8 발효', type: 'context', weight: 0.38, description: 'AI법 공식 발효일과 적용 일정', parentId: 'd8', abstractionLevel: 'instance' },
  { id: 'e5', label: 'Clearview 30억 사진 DB', type: 'concept', weight: 0.55, description: '소셜미디어에서 무단 수집한 얼굴 데이터 규모', parentId: 'd9', abstractionLevel: 'instance' },
  { id: 'e6', label: 'Getty 18억 달러 손해배상', type: 'concept', weight: 0.30, description: 'Stability AI 상대 손해배상 청구 금액', parentId: 'd11', abstractionLevel: 'instance' },
  { id: 'e7', label: 'Amazon AI 여성 이력서 감점', type: 'concept', weight: 0.50, description: '여성 대학명 포함 이력서 자동 감점 알고리즘', parentId: 'd13', abstractionLevel: 'instance' },
  { id: 'e8', label: 'SkillsFuture 크레딧 $500', type: 'context', weight: 0.18, description: '싱가포르 국민 1인당 연간 교육 크레딧', parentId: 'd4', abstractionLevel: 'instance' },
  { id: 'e9', label: 'PathAI FDA 승인 2023', type: 'concept', weight: 0.15, description: 'AI 병리 진단 도구 FDA 승인 사례', parentId: 'd15', abstractionLevel: 'instance' },
];

const DEMO_NODES_EN: RawNode[] = [
  // D0: Root (1)
  { id: 'root', label: 'AI & Human Society', type: 'concept', weight: 1.0, description: 'Multifaceted impact of AI on human society', parentId: null, abstractionLevel: 'superordinate' },

  // D1: Themes (5)
  { id: 't1', label: 'Reshaping Labor', type: 'concept', weight: 0.95, description: 'Fundamental changes in job structures due to AI automation', parentId: 'root', abstractionLevel: 'superordinate' },
  { id: 't2', label: 'Epistemological Shift', type: 'philosophy', weight: 0.85, description: 'Changes in knowledge production and truth verification', parentId: 'root', abstractionLevel: 'superordinate' },
  { id: 't3', label: 'Ethical Framework', type: 'philosophy', weight: 0.78, description: 'Moral judgment standards in the age of AI', parentId: 'root', abstractionLevel: 'superordinate' },
  { id: 't4', label: 'Social Inequality', type: 'context', weight: 0.65, description: 'Asymmetry in AI access and benefits', parentId: 'root', abstractionLevel: 'superordinate' },
  { id: 't5', label: 'Boundaries of Creativity', type: 'abstraction', weight: 0.55, description: 'Redefining creativity as a uniquely human domain', parentId: 'root', abstractionLevel: 'superordinate' },

  // D2: Core Concepts (20)
  { id: 'c1', label: 'Automation Spectrum', type: 'concept', weight: 0.92, description: 'Range of automation from repetitive to cognitive tasks', parentId: 't1', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'thesis' } },
  { id: 'c2', label: 'Human-AI Collaboration', type: 'concept', weight: 0.74, description: 'Complementary collaboration vs replacement competition', parentId: 't1', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'theoretical', rhetorical: 'thesis' } },
  { id: 'c3', label: 'Reskilling Infrastructure', type: 'context', weight: 0.45, description: 'Education systems for large-scale career transitions', parentId: 't1', abstractionLevel: 'basic', facets: { cognitive: 'context', epistemological: 'normative', rhetorical: 'warrant' } },
  { id: 'c4', label: 'Gig Economy Expansion', type: 'nuance', weight: 0.32, description: 'AI-accelerated shift to non-standard employment', parentId: 't1', abstractionLevel: 'basic', facets: { cognitive: 'nuance', epistemological: 'empirical', rhetorical: 'evidence' } },
  { id: 'c5', label: 'Deepfakes & Truth', type: 'concept', weight: 0.88, description: 'Impact of synthetic media on truth verification', parentId: 't2', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'thesis' } },
  { id: 'c6', label: 'LLM Hallucination', type: 'concept', weight: 0.68, description: 'Factual distortion in language models', parentId: 't2', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'antithesis' } },
  { id: 'c7', label: 'Collective Intelligence Shift', type: 'abstraction', weight: 0.42, description: 'New modes of knowledge production mediated by AI', parentId: 't2', abstractionLevel: 'basic', facets: { cognitive: 'abstraction', epistemological: 'theoretical', rhetorical: 'thesis' } },
  { id: 'c8', label: 'Academic Integrity', type: 'context', weight: 0.28, description: 'AI-generated papers and research authenticity', parentId: 't2', abstractionLevel: 'basic', facets: { cognitive: 'context', epistemological: 'normative', rhetorical: 'qualifier' } },
  { id: 'c9', label: 'Algorithmic Bias', type: 'concept', weight: 0.90, description: 'Reproduction of discrimination embedded in training data', parentId: 't3', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'evidence' } },
  { id: 'c10', label: 'Transparency Demands', type: 'philosophy', weight: 0.62, description: 'Explainability of AI decision-making', parentId: 't3', abstractionLevel: 'basic', facets: { cognitive: 'philosophy', epistemological: 'normative', rhetorical: 'thesis' } },
  { id: 'c11', label: 'Autonomous Weapons Ethics', type: 'mood', weight: 0.38, description: 'Moral dilemmas of lethal autonomous weapon systems', parentId: 't3', abstractionLevel: 'basic', facets: { cognitive: 'mood', epistemological: 'normative', rhetorical: 'antithesis' } },
  { id: 'c12', label: 'Privacy Invasion', type: 'concept', weight: 0.82, description: 'Surveillance capitalism and personal data', parentId: 't3', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'evidence' } },
  { id: 'c13', label: 'Digital Divide', type: 'concept', weight: 0.72, description: 'Gap in access to AI technologies', parentId: 't4', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'thesis' } },
  { id: 'c14', label: 'Global North-South Gap', type: 'context', weight: 0.48, description: 'Asymmetry between AI-developing and non-developing nations', parentId: 't4', abstractionLevel: 'basic', facets: { cognitive: 'context', epistemological: 'empirical', rhetorical: 'evidence' } },
  { id: 'c15', label: 'Data Colonialism', type: 'nuance', weight: 0.35, description: 'Data extraction structures in developing countries', parentId: 't4', abstractionLevel: 'basic', facets: { cognitive: 'nuance', epistemological: 'theoretical', rhetorical: 'antithesis' } },
  { id: 'c16', label: 'Medical AI Access', type: 'concept', weight: 0.22, description: 'Universal accessibility of diagnostic AI', parentId: 't4', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'qualifier' } },
  { id: 'c17', label: 'Generative AI Art', type: 'concept', weight: 0.58, description: 'Copyright and value of AI-created art', parentId: 't5', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'theoretical', rhetorical: 'thesis' } },
  { id: 'c18', label: 'Co-creation Paradigm', type: 'abstraction', weight: 0.40, description: 'New creative models of human-AI collaboration', parentId: 't5', abstractionLevel: 'basic', facets: { cognitive: 'abstraction', epistemological: 'theoretical', rhetorical: 'thesis' } },
  { id: 'c19', label: 'Mechanization of Literature', type: 'mood', weight: 0.25, description: 'Impact of AI narrative generation on literary value', parentId: 't5', abstractionLevel: 'basic', facets: { cognitive: 'mood', epistemological: 'normative', rhetorical: 'antithesis' } },
  { id: 'c20', label: 'Music Generation Algorithms', type: 'concept', weight: 0.18, description: 'Debate on artistic value of AI composition', parentId: 't5', abstractionLevel: 'basic', facets: { cognitive: 'concept', epistemological: 'empirical', rhetorical: 'qualifier' } },

  // D3: Sub-concepts (15)
  { id: 'd1', label: 'GPT-4 Coding Replacement 47%', type: 'concept', weight: 0.85, description: 'OpenAI study: 47% of programming tasks automatable', parentId: 'c1', abstractionLevel: 'subordinate' },
  { id: 'd2', label: 'Legal Document Analysis Automation', type: 'concept', weight: 0.52, description: 'Contract review 90% time reduction case', parentId: 'c1', abstractionLevel: 'subordinate' },
  { id: 'd3', label: 'Copilot Pair Programming', type: 'concept', weight: 0.60, description: 'GitHub Copilot 55% productivity increase data', parentId: 'c2', abstractionLevel: 'instance' },
  { id: 'd4', label: 'Singapore SkillsFuture', type: 'context', weight: 0.30, description: 'National-level AI reskilling program model', parentId: 'c3', abstractionLevel: 'instance' },
  { id: 'd5', label: 'Election Deepfake Incident', type: 'concept', weight: 0.80, description: '2024 US presidential election AI voice synthesis case', parentId: 'c5', abstractionLevel: 'instance' },
  { id: 'd6', label: 'AI Detection False Positives', type: 'concept', weight: 0.24, description: 'GPTZero 12% false positive rate issue', parentId: 'c8', abstractionLevel: 'subordinate' },
  { id: 'd7', label: 'COMPAS Recidivism Bias', type: 'concept', weight: 0.78, description: 'Over-prediction of Black defendants case', parentId: 'c9', abstractionLevel: 'instance' },
  { id: 'd8', label: 'EU AI Act High-Risk Classification', type: 'context', weight: 0.55, description: 'European AI regulation framework risk tiers', parentId: 'c10', abstractionLevel: 'subordinate' },
  { id: 'd9', label: 'Clearview AI Controversy', type: 'concept', weight: 0.70, description: 'Unauthorized facial recognition data collection lawsuit', parentId: 'c12', abstractionLevel: 'instance' },
  { id: 'd10', label: 'ChatGPT Blocked Countries', type: 'context', weight: 0.35, description: 'Access restrictions in Italy, China, etc.', parentId: 'c13', abstractionLevel: 'instance' },
  { id: 'd11', label: 'Stability AI Copyright Suit', type: 'concept', weight: 0.50, description: 'Getty Images vs Stability AI case', parentId: 'c17', abstractionLevel: 'instance' },
  { id: 'd12', label: 'Suno AI Music Copyright', type: 'concept', weight: 0.20, description: 'Copyright attribution debate for AI-generated music', parentId: 'c20', abstractionLevel: 'subordinate' },
  { id: 'd13', label: 'Amazon Hiring AI Scrapped', type: 'concept', weight: 0.65, description: 'Gender-biased hiring AI discontinuation case', parentId: 'c9', abstractionLevel: 'instance' },
  { id: 'd14', label: 'Uber Gig Worker Ruling', type: 'context', weight: 0.28, description: 'UK Supreme Court worker status recognition', parentId: 'c4', abstractionLevel: 'instance' },
  { id: 'd15', label: 'PathAI Diagnostic Accuracy', type: 'concept', weight: 0.42, description: 'Pathology AI 96% accuracy clinical trial', parentId: 'c16', abstractionLevel: 'subordinate' },

  // D4: Instances (9)
  { id: 'e1', label: 'GPT-4 Bar Exam Top 10%', type: 'concept', weight: 0.45, description: 'GPT-4 US bar exam performance', parentId: 'd2', abstractionLevel: 'instance' },
  { id: 'e2', label: 'Biden AI Voice Robocall', type: 'concept', weight: 0.75, description: '2024 New Hampshire primary AI voice incident', parentId: 'd5', abstractionLevel: 'instance' },
  { id: 'e3', label: 'ProPublica COMPAS Report', type: 'concept', weight: 0.68, description: '2016 recidivism racial bias investigation', parentId: 'd7', abstractionLevel: 'instance' },
  { id: 'e4', label: 'EU AI Act Effective Aug 2024', type: 'context', weight: 0.38, description: 'AI Act official effective date and timeline', parentId: 'd8', abstractionLevel: 'instance' },
  { id: 'e5', label: 'Clearview 3B Photo Database', type: 'concept', weight: 0.55, description: 'Scale of unauthorized facial data scraped from social media', parentId: 'd9', abstractionLevel: 'instance' },
  { id: 'e6', label: 'Getty $1.8B Damages Claim', type: 'concept', weight: 0.30, description: 'Damages claim against Stability AI', parentId: 'd11', abstractionLevel: 'instance' },
  { id: 'e7', label: 'Amazon AI Resume Gender Penalty', type: 'concept', weight: 0.50, description: 'Algorithm penalizing resumes with women\'s college names', parentId: 'd13', abstractionLevel: 'instance' },
  { id: 'e8', label: 'SkillsFuture Credit $500', type: 'context', weight: 0.18, description: 'Singapore annual per-citizen education credit', parentId: 'd4', abstractionLevel: 'instance' },
  { id: 'e9', label: 'PathAI FDA Approval 2023', type: 'concept', weight: 0.15, description: 'AI pathology diagnostic tool FDA clearance', parentId: 'd15', abstractionLevel: 'instance' },
];

function buildEdges(nodes: RawNode[]) {
  return [
    // Cross-links
    { sourceId: 'c1', targetId: 'c13', relation: 'causal', strength: 0.75 },
    { sourceId: 'c5', targetId: 'c10', relation: 'dependency', strength: 0.80 },
    { sourceId: 'c9', targetId: 'c15', relation: 'amplify', strength: 0.70 },
    { sourceId: 'c12', targetId: 'c5', relation: 'parallel', strength: 0.65 },
    { sourceId: 'c17', targetId: 'c6', relation: 'contrast', strength: 0.60 },
    { sourceId: 'c2', targetId: 'c18', relation: 'parallel', strength: 0.72 },
    { sourceId: 'c4', targetId: 'c14', relation: 'amplify', strength: 0.68 },
    { sourceId: 'c3', targetId: 'c13', relation: 'suppress', strength: 0.55 },
    { sourceId: 'c11', targetId: 'c10', relation: 'dependency', strength: 0.78 },
    { sourceId: 'c7', targetId: 'c19', relation: 'contrast', strength: 0.58 },
    { sourceId: 'd7', targetId: 'd13', relation: 'parallel', strength: 0.82 },
    { sourceId: 'd5', targetId: 'd9', relation: 'parallel', strength: 0.65 },
    // Parent-child
    ...nodes.filter(n => n.parentId).map(n => ({
      sourceId: n.parentId!, targetId: n.id, relation: 'parent-child' as const, strength: 0.8,
    })),
  ];
}

export function loadDemoData(sphereRadius: number, lang: Lang = 'ko'): { nodes: NodeData[]; edges: EdgeData[] } {
  const demoNodes = lang === 'en' ? DEMO_NODES_EN : DEMO_NODES_KO;
  const demoEdges = buildEdges(demoNodes);
  return mapHierarchicalToSphere(demoNodes, demoEdges, sphereRadius, 5);
}
