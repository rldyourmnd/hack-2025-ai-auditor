'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft,
  BookOpen, 
  Clock, 
  Target, 
  Star, 
  Image as ImageIcon, 
  PlayCircle,
  Tag,
  Share2,
  Download,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// Articles metadata - должно совпадать с metadata в articles/page.tsx
const articlesData = {
  articles: [
    {
      id: 1,
      title: "Как мы сталкиваемся с галлюцинациями",
      description: "Введение в проблематику AI галлюцинаций: почему возникает ощущение обмана при общении с нейросетями, отличие галлюцинаций от обычных ошибок, эффект подхалимства в LLM и практические советы по управлению эмоциями.",
      excerpt: "Наверняка вы замечали это странное чувство, когда общаетесь с нейросетью: вроде бы ответ звучит убедительно, логично и красиво, но что-то в нем не так...",
      readingTime: "8 мин",
      difficulty: "beginner",
      practicalExercises: 3,
      images: ["image.png", "image 1.png", "image 2.png", "image 3.png"],
      tags: ["основы", "психология", "пользовательский опыт"],
      mainTopic: "Introduction to AI Hallucinations",
      section: "Введение и основы"
    },
    {
      id: 2,
      title: "Почему LLM галлюцинируют",
      description: "Техническое объяснение природы галлюцинаций в языковых моделях: статистическая генерация, архитектура трансформеров, CHOKE-эффект и проблемы измерения уверенности.",
      excerpt: "LLM не знает, что «правда», а что нет. Она просто продолжает текст — выбирает следующее слово, которое статистически лучше подходит к предыдущим.",
      readingTime: "2 мин",
      difficulty: "intermediate",
      practicalExercises: 0,
      images: ["image.png"],
      tags: ["архитектура", "статистика", "трансформеры"],
      mainTopic: "Technical Mechanisms",
      section: "Введение и основы"
    },
    {
      id: 3,
      title: "Особенности подготовки моделей",
      description: "Влияние этапов обучения на склонность к галлюцинациям: ограничения данных, предобучение, дообучение, переобучение, супервизорство и проблемы с гвардами безопасности.",
      excerpt: "Главный источник галлюцинаций — это несовершенство обучающих данных. Если в корпусе много устаревшей информации, повторов, домыслов или предвзятостей...",
      readingTime: "3 мин",
      difficulty: "intermediate",
      practicalExercises: 0,
      images: ["image.png", "image 1.png", "image 2.png"],
      tags: ["обучение", "данные", "переобучение"],
      mainTopic: "Model Training Issues",
      section: "Причины и механизмы"
    },
    {
      id: 4,
      title: "Семантический шум",
      description: "Типы семантических искажений в LLM: интерференция многозначных слов, семантическая энтропия, онтологическая дрожь и их влияние на качество генерации.",
      excerpt: "Семантический шум — это то, что превращает работу LLM из чёткого генератора ответов в источник иногда совершенно непредсказуемых фантазий.",
      readingTime: "4 мин",
      difficulty: "advanced",
      practicalExercises: 2,
      images: ["image.png"],
      tags: ["семантика", "многозначность", "энтропия"],
      mainTopic: "Semantic Issues",
      section: "Причины и механизмы"
    },
    {
      id: 5,
      title: "Причины галлюцинаций",
      description: "Классификация причин галлюцинаций по четырем типам: фактологические, контекстуальные, логические и лингвистические ошибки с практическими примерами каждого типа.",
      excerpt: "Представьте: вы спрашиваете ассистента на базе LLM — \"когда была построена Эйфелева башня?\". Модель без малейшего сомнения отвечает: \"В 1895 году, к 100-летию окончания Первой мировой войны\".",
      readingTime: "6 мин",
      difficulty: "intermediate",
      practicalExercises: 4,
      images: ["image.png", "image 1.png", "image 2.png", "image 3.png"],
      tags: ["классификация", "фактология", "контекст"],
      mainTopic: "Classification of Hallucination Types",
      section: "Причины и механизмы"
    },
    {
      id: 6,
      title: "Направления галлюцинаций",
      description: "Разделение галлюцинаций на внутренние (intrinsic) и внешние (extrinsic) типы: границы знаний, заполнение пробелов, конфликты контекста и потеря инструкций.",
      excerpt: "Внутренние галлюцинации — один из самых частых и опасных типов галлюцинаций в LLM. Это ситуации, когда модель уверенно придумывает несуществующие факты, даты, имена, детали.",
      readingTime: "3 мин",
      difficulty: "advanced",
      practicalExercises: 0,
      images: [],
      tags: ["внутренние", "внешние", "классификация"],
      mainTopic: "Intrinsic vs Extrinsic Hallucinations",
      section: "Причины и механизмы"
    },
    {
      id: 7,
      title: "Как понять, что модель фантазирует",
      description: "Методы обнаружения галлюцинаций: SelfCheckGPT, семантическая энтропия, бенчмарки (TruthfulQA, Vectara), метрики оценки (faithfulness, factuality, entailment) с практическими инструментами.",
      excerpt: "Представьте, что у вас на совещании несколько экспертов, и вы задаёте им один и тот же вопрос по очереди — если все хором отвечают одно, вы расслабляетесь: скорее всего, это правда.",
      readingTime: "10 мин",
      difficulty: "advanced",
      practicalExercises: 4,
      images: ["image.png"],
      tags: ["детекция", "метрики", "бенчмарки"],
      mainTopic: "Detection Methods and Metrics",
      section: "Обнаружение и решения"
    },
    {
      id: 8,
      title: "Что делать: инженерия и практики",
      description: "Комплексные подходы к снижению галлюцинаций: инженерия промптов (ICE, Step-Back, Chain-of-Verification), системные решения (RAG, контекст-инжиниринг, графы знаний), практические и перспективные методы.",
      excerpt: "Инженерия промптов — это не просто \"правильная формулировка промпта\", а осознанное управление всей информацией, которую получает LLM: инструкции, ввод пользователя, история, внешние факты, ограничения.",
      readingTime: "12 мин",
      difficulty: "expert",
      practicalExercises: 3,
      images: ["image.png", "image 1.png", "image 2.png", "image 3.png"],
      tags: ["промпт-инжиниринг", "RAG", "системные подходы"],
      mainTopic: "Mitigation Strategies and Engineering",
      section: "Обнаружение и решения"
    },
    {
      id: 9,
      title: "Что не помогает",
      description: "Разбор неэффективных методов борьбы с галлюцинациями: фразы \"According to...\", негативный промптинг, назначение ролей, рефлексивные промпты и простые инструкции \"Say I don't know\".",
      excerpt: "Вокруг LLM сложился целый арсенал \"магических приёмов\", которые вроде бы должны снижать количество галлюцинаций. Однако, по итогам исследований и обзоров, большинство из них на деле оказываются малоэффективными.",
      readingTime: "2 мин",
      difficulty: "intermediate",
      practicalExercises: 0,
      images: [],
      tags: ["мифы", "неэффективные методы", "промптинг"],
      mainTopic: "Ineffective Methods",
      section: "Важные ограничения"
    }
  ]
};

export default function ArticlePage() {
  const params = useParams();
  const articleId = params?.id ? parseInt(params.id as string, 10) : null;
  const [articleContent, setArticleContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Find article metadata
  const article = articlesData.articles.find(a => a.id === articleId);

  // Curestry brand colors
  const curestryColors = {
    text: '#ffffff',
    background: '#000000',
    primary: '#2AC8AA',
    secondary: '#b9d1cc',
    accent: '#27c7fb',
    info: '#3F51B5',
    success: '#43A047',
    warning: '#FFC107',
    error: '#EF4444',
    border: '#333333',
    muted: '#888888'
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return curestryColors.success;
      case 'intermediate': return curestryColors.warning;
      case 'advanced': return curestryColors.accent;
      case 'expert': return curestryColors.error;
      default: return curestryColors.muted;
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'Начинающий';
      case 'intermediate': return 'Средний';
      case 'advanced': return 'Продвинутый';
      case 'expert': return 'Эксперт';
      default: return difficulty;
    }
  };

  useEffect(() => {
    async function loadArticle() {
      if (!articleId || !article) {
        setError('Статья не найдена');
        setLoading(false);
        return;
      }

      try {
        // Fetch markdown content from the public folder
        const fileName = getMarkdownFileName(articleId);
        const response = await fetch(`/articles/${articleId}/${fileName}`);
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить содержимое статьи');
        }
        
        const content = await response.text();
        setArticleContent(content);
      } catch (err) {
        console.error('Error loading article:', err);
        setError('Ошибка при загрузке статьи');
      } finally {
        setLoading(false);
      }
    }

    loadArticle();
  }, [articleId, article]);

  // Get the markdown filename based on article ID
  const getMarkdownFileName = (id: number) => {
    const fileNames: { [key: number]: string } = {
      1: 'Как мы сталкиваемся с галлюцинациями.md',
      2: 'Почему LLM галлюцинируют.md',
      3: 'Особенности подготовки моделей.md',
      4: 'Семантический шум.md',
      5: 'Причины галлюцинаций.md',
      6: 'Направления галлюцинаций.md',
      7: 'Как понять, что модель фантазирует.md',
      8: 'Что делать инженерия и практики.md',
      9: 'Что не помогает.md'
    };
    return fileNames[id] || `article-${id}.md`;
  };

  // Simple markdown parser for rendering
  const parseMarkdown = (content: string) => {
    const lines = content.split('\n');
    const parsed: JSX.Element[] = [];
    let currentIndex = 0;

    while (currentIndex < lines.length) {
      const line = lines[currentIndex];

      // Headers
      if (line.startsWith('# ')) {
        parsed.push(
          <h1 
            key={currentIndex}
            className="text-4xl font-bold mb-6 mt-8"
            style={{ 
              color: curestryColors.text,
              fontFamily: "'Montserrat', system-ui"
            }}
          >
            {line.substring(2)}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        parsed.push(
          <h2 
            key={currentIndex}
            className="text-3xl font-bold mb-4 mt-8"
            style={{ 
              color: curestryColors.primary,
              fontFamily: "'Montserrat', system-ui"
            }}
          >
            {line.substring(3)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        parsed.push(
          <h3 
            key={currentIndex}
            className="text-2xl font-semibold mb-4 mt-6"
            style={{ 
              color: curestryColors.accent,
              fontFamily: "'Montserrat', system-ui"
            }}
          >
            {line.substring(4)}
          </h3>
        );
      }
      // Images
      else if (line.includes('![') && line.includes('](')) {
        const match = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        if (match) {
          const [, alt, src] = match;
          parsed.push(
            <div key={currentIndex} className="my-6 text-center">
              <img
                src={`/articles/${articleId}/${src}`}
                alt={alt}
                className="max-w-full h-auto mx-auto rounded-lg border"
                style={{ borderColor: curestryColors.border }}
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                }}
              />
            </div>
          );
        }
      }
      // Bold text
      else if (line.includes('**')) {
        const parts = line.split('**');
        const elements: (string | JSX.Element)[] = [];
        for (let i = 0; i < parts.length; i++) {
          if (i % 2 === 1) {
            elements.push(
              <strong 
                key={i} 
                style={{ color: curestryColors.primary }}
              >
                {parts[i]}
              </strong>
            );
          } else {
            elements.push(parts[i]);
          }
        }
        
        parsed.push(
          <p 
            key={currentIndex}
            className="mb-4 leading-relaxed"
            style={{ 
              color: curestryColors.secondary,
              fontFamily: "'Open Sans', system-ui"
            }}
          >
            {elements}
          </p>
        );
      }
      // Regular paragraphs
      else if (line.trim()) {
        parsed.push(
          <p 
            key={currentIndex}
            className="mb-4 leading-relaxed"
            style={{ 
              color: curestryColors.secondary,
              fontFamily: "'Open Sans', system-ui"
            }}
          >
            {line}
          </p>
        );
      }
      // Empty lines for spacing
      else {
        parsed.push(<div key={currentIndex} className="mb-2" />);
      }

      currentIndex++;
    }

    return parsed;
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: curestryColors.background }}
      >
        <div className="text-center">
          <BookOpen
            className="mx-auto h-12 w-12 mb-4"
            style={{ color: curestryColors.primary }}
          />
          <p style={{ color: curestryColors.text }}>Загрузка статьи...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: curestryColors.background }}
      >
        <div className="text-center max-w-md mx-auto px-4">
          <div
            className="text-6xl mb-4"
            style={{ color: curestryColors.error }}
          >
            404
          </div>
          <h1
            className="text-2xl font-bold mb-4"
            style={{ color: curestryColors.text }}
          >
            Статья не найдена
          </h1>
          <p
            className="text-sm mb-6"
            style={{ color: curestryColors.secondary }}
          >
            {error || 'Запрашиваемая статья не существует или была удалена.'}
          </p>
          <Link href="/articles">
            <Button
              className="px-6 py-2"
              style={{
                backgroundColor: curestryColors.primary,
                color: curestryColors.background
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Вернуться к статьям
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: curestryColors.background }}
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Navigation */}
        <div className="mb-8">
          <Link href="/articles">
            <Button
              variant="ghost"
              className="mb-6"
              style={{
                color: curestryColors.text,
                borderColor: curestryColors.border
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Все статьи
            </Button>
          </Link>
        </div>

        {/* Article Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <span
              className="px-3 py-1 rounded-full text-sm font-semibold"
              style={{
                backgroundColor: getDifficultyColor(article.difficulty),
                color: curestryColors.background
              }}
            >
              {getDifficultyLabel(article.difficulty)}
            </span>
            <div
              className="flex items-center text-sm"
              style={{ color: curestryColors.muted }}
            >
              <Clock className="h-4 w-4 mr-1" />
              {article.readingTime}
            </div>
            {article.practicalExercises > 0 && (
              <div
                className="flex items-center text-sm"
                style={{ color: curestryColors.accent }}
              >
                <PlayCircle className="h-4 w-4 mr-1" />
                {article.practicalExercises} практик
              </div>
            )}
          </div>

          <h1
            className="text-5xl font-bold mb-6"
            style={{
              color: curestryColors.text,
              fontFamily: "'Montserrat', system-ui"
            }}
          >
            {article.title}
          </h1>

          <p
            className="text-xl mb-6 leading-relaxed"
            style={{
              color: curestryColors.secondary,
              fontFamily: "'Open Sans', system-ui"
            }}
          >
            {article.description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            {article.tags.map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 rounded-full text-sm"
                style={{
                  backgroundColor: curestryColors.border + '80',
                  color: curestryColors.secondary
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Article Content */}
        <Card
          className="border"
          style={{
            backgroundColor: curestryColors.background,
            borderColor: curestryColors.border
          }}
        >
          <CardContent className="p-8">
            <div className="prose prose-lg max-w-none">
              {parseMarkdown(articleContent)}
            </div>
          </CardContent>
        </Card>

        {/* Navigation footer */}
        <div className="mt-12 flex justify-between items-center">
          <Link href="/articles">
            <Button
              variant="outline"
              style={{
                borderColor: curestryColors.border,
                color: curestryColors.text,
                backgroundColor: 'transparent'
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Все статьи
            </Button>
          </Link>
          
          <div className="flex gap-2">
            {article.id > 1 && (
              <Link href={`/articles/${article.id - 1}`}>
                <Button
                  variant="outline"
                  style={{
                    borderColor: curestryColors.border,
                    color: curestryColors.text,
                    backgroundColor: 'transparent'
                  }}
                >
                  Предыдущая
                </Button>
              </Link>
            )}
            {article.id < 9 && (
              <Link href={`/articles/${article.id + 1}`}>
                <Button
                  style={{
                    backgroundColor: curestryColors.primary,
                    color: curestryColors.background
                  }}
                >
                  Следующая
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}