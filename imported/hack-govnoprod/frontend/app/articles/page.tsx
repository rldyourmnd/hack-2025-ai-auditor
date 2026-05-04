'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  Clock, 
  Target, 
  Star, 
  Image as ImageIcon, 
  PlayCircle,
  Filter,
  Search,
  Tag,
  TrendingUp,
  Users,
  Award
} from 'lucide-react';
import Link from 'next/link';

// Articles metadata - в реальном проекте это было бы в отдельном файле
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
  ],
  statistics: {
    totalArticles: 9,
    totalReadingTime: "50 мин",
    totalImages: 13,
    totalPracticalExercises: 16
  },
  sections: [
    { title: "Введение и основы", articles: [1, 2], description: "Знакомство с проблемой AI галлюцинаций" },
    { title: "Причины и механизмы", articles: [3, 4, 5, 6], description: "Глубокое понимание причин возникновения галлюцинаций" },
    { title: "Обнаружение и решения", articles: [7, 8], description: "Методы детекции и борьбы с галлюцинациями" },
    { title: "Важные ограничения", articles: [9], description: "Что не работает в борьбе с галлюцинациями" }
  ]
};

export default function ArticlesPage() {
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const filteredArticles = articlesData.articles.filter(article => {
    const matchesDifficulty = selectedDifficulty === 'all' || article.difficulty === selectedDifficulty;
    const matchesSection = selectedSection === 'all' || article.section === selectedSection;
    const matchesSearch = searchQuery === '' || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesDifficulty && matchesSection && matchesSearch;
  });

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: curestryColors.background }}
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mb-6">
            <img
              src="/logo-256.png"
              alt="Curestry Logo"
              className="mx-auto w-16 h-16 mb-4"
            />
          </div>
          <h1
            className="text-5xl font-bold mb-6"
            style={{
              color: curestryColors.text,
              fontFamily: "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            }}
          >
            Экспертные статьи о <span style={{ color: curestryColors.primary }}>AI галлюцинациях</span>
          </h1>
          <p
            className="text-xl mb-8 max-w-4xl mx-auto leading-relaxed"
            style={{
              color: curestryColors.secondary,
              fontFamily: "'Open Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
            }}
          >
            Полное руководство по пониманию, обнаружению и управлению галлюцинациями в больших языковых моделях.
            От базовых концепций до продвинутых методов детекции и митигации.
          </p>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mb-8">
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <div
                className="text-2xl font-bold mb-1"
                style={{
                  color: curestryColors.primary,
                  fontFamily: "'Montserrat', system-ui"
                }}
              >
                {articlesData.statistics.totalArticles}
              </div>
              <div
                className="text-sm"
                style={{ color: curestryColors.secondary }}
              >
                статей
              </div>
            </div>
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <div
                className="text-2xl font-bold mb-1"
                style={{
                  color: curestryColors.accent,
                  fontFamily: "'Montserrat', system-ui"
                }}
              >
                {articlesData.statistics.totalReadingTime}
              </div>
              <div
                className="text-sm"
                style={{ color: curestryColors.secondary }}
              >
                чтения
              </div>
            </div>
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <div
                className="text-2xl font-bold mb-1"
                style={{
                  color: curestryColors.success,
                  fontFamily: "'Montserrat', system-ui"
                }}
              >
                {articlesData.statistics.totalPracticalExercises}
              </div>
              <div
                className="text-sm"
                style={{ color: curestryColors.secondary }}
              >
                практик
              </div>
            </div>
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              <div
                className="text-2xl font-bold mb-1"
                style={{
                  color: curestryColors.warning,
                  fontFamily: "'Montserrat', system-ui"
                }}
              >
                {articlesData.statistics.totalImages}
              </div>
              <div
                className="text-sm"
                style={{ color: curestryColors.secondary }}
              >
                изображений
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <div
            className="rounded-lg border p-6"
            style={{
              backgroundColor: curestryColors.background,
              borderColor: curestryColors.border
            }}
          >
            <div className="grid md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4"
                  style={{ color: curestryColors.muted }}
                />
                <input
                  type="text"
                  placeholder="Поиск по статьям..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-opacity-50"
                  style={{
                    backgroundColor: curestryColors.background,
                    borderColor: curestryColors.border,
                    color: curestryColors.text,
                    fontFamily: "'Open Sans', system-ui"
                  }}
                />
              </div>

              {/* Difficulty Filter */}
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border"
                style={{
                  backgroundColor: curestryColors.background,
                  borderColor: curestryColors.border,
                  color: curestryColors.text,
                  fontFamily: "'Open Sans', system-ui"
                }}
              >
                <option value="all">Все уровни</option>
                <option value="beginner">Начинающий</option>
                <option value="intermediate">Средний</option>
                <option value="advanced">Продвинутый</option>
                <option value="expert">Эксперт</option>
              </select>

              {/* Section Filter */}
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border"
                style={{
                  backgroundColor: curestryColors.background,
                  borderColor: curestryColors.border,
                  color: curestryColors.text,
                  fontFamily: "'Open Sans', system-ui"
                }}
              >
                <option value="all">Все разделы</option>
                {articlesData.sections.map((section, index) => (
                  <option key={index} value={section.title}>
                    {section.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Articles Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredArticles.map((article) => (
            <div
              key={article.id}
              className="rounded-lg border transition-all hover:scale-105 overflow-hidden group"
              style={{
                backgroundColor: curestryColors.background,
                borderColor: curestryColors.border
              }}
            >
              {/* Article Image */}
              <div
                className="h-48 flex items-center justify-center border-b relative"
                style={{
                  backgroundColor: curestryColors.primary + '10',
                  borderColor: curestryColors.border
                }}
              >
                {article.images.length > 0 ? (
                  <img
                    src={`/articles/${article.id}/${article.images[0]}`}
                    alt={article.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to placeholder if image fails to load
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`${article.images.length > 0 ? 'hidden' : 'flex'} items-center justify-center w-full h-full`}>
                  <div className="text-center">
                    <BookOpen
                      className="mx-auto h-12 w-12 mb-2"
                      style={{ color: curestryColors.primary }}
                    />
                    <span
                      className="text-sm"
                      style={{ color: curestryColors.secondary }}
                    >
                      Статья #{article.id}
                    </span>
                  </div>
                </div>

                {/* Difficulty Badge */}
                <div className="absolute top-3 right-3">
                  <span
                    className="px-2 py-1 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: getDifficultyColor(article.difficulty),
                      color: curestryColors.background
                    }}
                  >
                    {getDifficultyLabel(article.difficulty)}
                  </span>
                </div>
              </div>

              {/* Article Content */}
              <div className="p-6">
                <div className="flex items-center gap-4 mb-3 text-sm">
                  <div
                    className="flex items-center"
                    style={{ color: curestryColors.muted }}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    {article.readingTime}
                  </div>
                  {article.practicalExercises > 0 && (
                    <div
                      className="flex items-center"
                      style={{ color: curestryColors.accent }}
                    >
                      <PlayCircle className="h-4 w-4 mr-1" />
                      {article.practicalExercises} практик
                    </div>
                  )}
                  {article.images.length > 0 && (
                    <div
                      className="flex items-center"
                      style={{ color: curestryColors.warning }}
                    >
                      <ImageIcon className="h-4 w-4 mr-1" />
                      {article.images.length}
                    </div>
                  )}
                </div>

                <h3
                  className="text-xl font-bold mb-3 group-hover:text-opacity-80 transition-all"
                  style={{
                    color: curestryColors.text,
                    fontFamily: "'Montserrat', system-ui"
                  }}
                >
                  {article.title}
                </h3>

                <p
                  className="text-sm mb-4 leading-relaxed"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui"
                  }}
                >
                  {article.excerpt}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {article.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 rounded text-xs"
                      style={{
                        backgroundColor: curestryColors.border + '80',
                        color: curestryColors.secondary
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Read More Button */}
                <Link href={`/articles/${article.id}`}>
                  <button
                    className="w-full px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 flex items-center justify-center"
                    style={{
                      backgroundColor: curestryColors.primary,
                      color: curestryColors.background,
                      fontFamily: "'Open Sans', system-ui"
                    }}
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    Читать статью
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* No Results */}
        {filteredArticles.length === 0 && (
          <div className="text-center py-12">
            <Search
              className="mx-auto h-12 w-12 mb-4"
              style={{ color: curestryColors.muted }}
            />
            <h3
              className="text-xl font-semibold mb-2"
              style={{ color: curestryColors.text }}
            >
              Статьи не найдены
            </h3>
            <p
              className="text-sm"
              style={{ color: curestryColors.secondary }}
            >
              Попробуйте изменить фильтры или поисковый запрос
            </p>
          </div>
        )}

        {/* Series Overview */}
        <div className="mt-16">
          <h2
            className="text-3xl font-bold text-center mb-8"
            style={{
              color: curestryColors.text,
              fontFamily: "'Montserrat', system-ui"
            }}
          >
            Структура серии
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {articlesData.sections.map((section, index) => (
              <div
                key={index}
                className="rounded-lg border p-6"
                style={{
                  backgroundColor: curestryColors.background,
                  borderColor: curestryColors.border
                }}
              >
                <h3
                  className="text-xl font-semibold mb-3"
                  style={{ color: curestryColors.primary }}
                >
                  {section.title}
                </h3>
                <p
                  className="text-sm mb-4"
                  style={{
                    color: curestryColors.secondary,
                    fontFamily: "'Open Sans', system-ui"
                  }}
                >
                  {section.description}
                </p>
                <div className="space-y-2">
                  {section.articles.map(articleId => {
                    const article = articlesData.articles.find(a => a.id === articleId);
                    if (!article) return null;
                    return (
                      <Link key={articleId} href={`/articles/${articleId}`}>
                        <div
                          className="flex items-center justify-between p-3 rounded border transition-all hover:scale-102"
                          style={{
                            borderColor: curestryColors.border,
                            backgroundColor: curestryColors.border + '20'
                          }}
                        >
                          <span
                            className="font-medium text-sm"
                            style={{ color: curestryColors.text }}
                          >
                            {article.title}
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: curestryColors.muted }}
                          >
                            {article.readingTime}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}