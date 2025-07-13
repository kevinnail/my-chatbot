// Agentic email analysis using local Ollama
export async function analyzeEmailWithLLM(subject, body, from) {
  try {
    const systemPrompt = `You are an intelligent email agent that helps web developers manage their professional emails. 
    You analyze emails and provide actionable insights. Your responses should be structured JSON with this format:
    {
      "isWebDevRelated": true/false,
      "category": "job_application|job_rejection|job_acceptance|job_interview|job_offer|event|learning|tools|networking|newsletter|community|freelance|other",
      "priority": "high|medium|low",
      "summary": "Brief summary of the email content",
      "actionItems": ["action1", "action2"],
      "sentiment": "positive|negative|neutral",
      "draftResponse": "Suggested response if appropriate, or null"
    }

    Focus on detecting web development related emails including:
    
    JOB RELATED:
    - Job applications confirmations
    - Interview invitations and scheduling
    - Rejection letters
    - Job offers and negotiations
    - Application status updates
    - Recruiter outreach
    - Job board notifications (Built In, LinkedIn, Indeed, Stack Overflow Jobs, etc.)
    - Contract/freelance opportunities
    
    EVENT RELATED:
    - Tech conferences and meetups
    - Webinars and workshops
    - Hackathons and coding challenges
    - Industry events and networking
    - Training sessions and boot camps
    - Company tech talks
    
    LEARNING RELATED:
    - Course platforms (Udemy, Coursera, Pluralsight, etc.)
    - Tutorial sites and coding platforms
    - Certification programs
    - Technical book releases
    - Educational content updates
    
    TOOLS & TECHNOLOGY:
    - Platform updates (AWS, Google Cloud, Azure, etc.)
    - Framework releases (React, Angular, Vue, etc.)
    - Development tool updates
    - API documentation and changes
    - Software licenses and subscriptions
    - IDE and editor updates
    
    COMMUNITY & NETWORKING:
    - Developer community updates
    - Open source project notifications
    - GitHub activity and contributions
    - Technical forum discussions
    - Developer newsletter subscriptions
    - Coding community events
    
    OTHER PROFESSIONAL:
    - Client communications
    - Project updates and deadlines
    - Team collaboration emails
    - Code review notifications
    - Professional development opportunities

    Be comprehensive but accurate in your categorization.`;

    const userPrompt = `Analyze this email:
    Subject: ${subject}
    Body: ${body}
    From: ${from}

Provide your analysis in the JSON format specified.`;

    const response = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        options: {
          temperature: 0.3, // Lower temperature for more consistent JSON output
          top_p: 0.9,
        },
        stream: false,
      }),
    });

    const data = await response.json();
    const rawResponse = data.message?.content || '';

    try {
      // Try to parse JSON response
      const analysisMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (analysisMatch) {
        return JSON.parse(analysisMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing LLM JSON response:', parseError);
    }

    // Fallback analysis if JSON parsing fails
    const fallbackAnalysis = {
      isWebDevRelated: checkWebDevKeywords(subject, body, from),
      category: 'other',
      priority: 'medium',
      summary: rawResponse.slice(0, 150) + '...',
      actionItems: [],
      sentiment: 'neutral',
      draftResponse: null,
    };

    return fallbackAnalysis;
  } catch (error) {
    console.error('Error analyzing email with LLM:', error);
    return {
      isWebDevRelated: checkWebDevKeywords(subject, body, from),
      category: 'other',
      priority: 'low',
      summary: 'Analysis failed - please review manually',
      actionItems: [],
      sentiment: 'neutral',
      draftResponse: null,
    };
  }
}

// Fallback web development keyword detection
export function checkWebDevKeywords(subject, body, from) {
  const webDevKeywords = [
    // Job related terms
    'job',
    'interview',
    'application',
    'position',
    'career',
    'hiring',
    'recruiter',
    'opportunity',
    'candidate',
    'resume',
    'cv',
    'offer',
    'salary',
    'benefits',
    'rejection',
    'not selected',
    'moved forward',

    // Developer roles
    'developer',
    'engineer',
    'software engineer',
    'web developer',
    'frontend developer',
    'backend developer',
    'full stack developer',
    'full stack engineer',
    'fullstack',
    'mobile developer',
    'react developer',
    'javascript developer',
    'node.js developer',
    'python developer',
    'java developer',
    'php developer',
    'devops engineer',
    'ui developer',
    'ux developer',
    'front end',
    'back end',
    'frontend',
    'backend',

    // Technologies and frameworks
    'react',
    'angular',
    'vue',
    'javascript',
    'typescript',
    'node.js',
    'python',
    'java',
    'php',
    'ruby',
    'html',
    'css',
    'sass',
    'scss',
    'bootstrap',
    'tailwind',
    'mongodb',
    'mysql',
    'postgresql',
    'redis',
    'aws',
    'azure',
    'google cloud',
    'docker',
    'kubernetes',
    'git',
    'github',
    'gitlab',
    'bitbucket',

    // Company types and job boards
    'built in',
    'linkedin',
    'indeed',
    'stack overflow',
    'github jobs',
    'angel list',
    'glassdoor',
    'dice',
    'monster',
    'ziprecruiter',
    'flexa',
    'startup',
    'tech company',

    // Event related
    'conference',
    'meetup',
    'webinar',
    'workshop',
    'hackathon',
    'coding challenge',
    'tech talk',
    'training',
    'bootcamp',
    'event',
    'networking',

    // Learning platforms
    'udemy',
    'coursera',
    'pluralsight',
    'codecademy',
    'freecodecamp',
    'lynda',
    'edx',
    'khan academy',
    'treehouse',
    'skillshare',
    'tutorial',
    'course',

    // Tools and platforms
    'visual studio code',
    'vscode',
    'sublime text',
    'atom',
    'intellij',
    'webstorm',
    'figma',
    'sketch',
    'adobe xd',
    'postman',
    'insomnia',
    'slack',
    'discord',
    'jira',
    'trello',
    'asana',
    'notion',
    'confluence',

    // Community and newsletters
    'hacker news',
    'dev.to',
    'medium',
    'newsletter',
    'weekly',
    'digest',
    'open source',
    'github',
    'contribution',
    'pull request',
    'code review',

    // Professional development
    'certification',
    'learning path',
    'skill development',
    'career growth',
    'professional development',
    'tech trends',
    'industry update',
  ];

  const text = `${subject} ${body} ${from}`.toLowerCase();
  return webDevKeywords.some((keyword) => text.includes(keyword));
}
