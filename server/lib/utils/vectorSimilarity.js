import { getEmbedding } from './ollamaEmbed.js';

// Web development email category definition
const WEB_DEV_CATEGORY = {
  threshold: 0.5,
  referenceText: `
    web development job application matches interview position software engineer developer     
     rejection not selected moved forward resume react javascript node.js express typescript      
     frontend backend full stack developer career coding programming technical interview
    job offer recruitment startup tech company software development career opportunity
    AI community meetup zoom machine learning AI agent AI assistant AI chatbot AI chat HTML5 CSS3       
    SCSS Sass LESS responsive design flexbox grid layout Webpack Babel ESLint Prettier
    Bootstrap Tailwind CSS Material UI Ant Design Chakra UI Figma Sketch Adobe XD UX/UI
    accessibility SEO performance optimization REST API GraphQL microservices serverless
    Docker Kubernetes AWS Azure Google Cloud Platform GCP CI/CD Git GitHub GitLab
    version control unit testing integration testing end-to-end testing Jest Mocha
    Cypress Selenium project manager hiring manager recruiter HR salary compensation
    benefits equity relocation visa sponsorship remote on-site hybrid
    internship contract freelance full-time part-time coding test take-home assignment
    whiteboard interview pair programming technical screening code challenge algorithm
    design data structures system design code review pull request merge request backlog
    grooming sprint planning agile scrum kanban stand-up retrospective team collaboration
    soft skills communication skills problem solving career growth leadership mentorship
    deep learning neural network data science ML engineer data engineer AI engineer NLP
    natural language processing computer vision transformer GPT BERT LLM embeddings
    RAG vector database systems administrator network administrator indeed linkedin
    job board job search career opportunity employment hiring manager recruiter
    technical role IT position computer science engineering technology
  `,
};

// Vector pre-filtering for web development emails only
export async function preFilterWebDevEmails(emails) {
  try {
    // eslint-disable-next-line no-console
    console.log('Pre-filtering emails using vector similarity...');

    // Generate embedding for web development category
    const webDevEmbedding = await getEmbedding(WEB_DEV_CATEGORY.referenceText);

    // Calculate similarity for each email against web development only
    const emailsWithSimilarity = await Promise.all(
      emails.map(async (email) => {
        const emailContent = `${email.subject} ${email.body} ${email.from}`;
        const emailEmbedding = await getEmbedding(emailContent);

        // Calculate similarity score for web development
        const webDevScore = calculateCosineSimilarity(webDevEmbedding, emailEmbedding);
        const isWebDev = webDevScore >= WEB_DEV_CATEGORY.threshold;

        // eslint-disable-next-line no-console
        console.log(
          ` Email: "${email.subject.substring(0, 50)}..." - Web Dev Score: ${webDevScore.toFixed(3)} - ${isWebDev ? 'INCLUDE' : 'EXCLUDE'}`,
        );

        return {
          ...email,
          similarity: webDevScore, // Keep for backward compatibility
          webDevScore,
          likelyWebDev: isWebDev,
          reason: isWebDev ? 'web_dev' : 'low_similarity',
        };
      }),
    );

    // Sort by web development similarity score only
    const sortedEmails = emailsWithSimilarity.sort((a, b) => b.webDevScore - a.webDevScore);

    // Filter emails that meet the web development threshold
    const likelyWebDevEmails = sortedEmails.filter((email) => email.likelyWebDev);
    const unlikelyEmails = sortedEmails.filter((email) => !email.likelyWebDev);

    // eslint-disable-next-line no-console
    console.log(`Vector pre-filtering results:
      - Total emails: ${emails.length}
      - Web-dev emails: ${likelyWebDevEmails.length}
      - Low similarity: ${unlikelyEmails.length}
      - LLM calls reduced by: ${emails.length === 0 ? 0 : Math.round((unlikelyEmails.length / emails.length) * 100)}%`);

    return {
      likelyWebDevEmails,
      unlikelyEmails,
      totalEmails: emails.length,
      reductionPercentage:
        emails.length === 0 ? 0 : Math.round((unlikelyEmails.length / emails.length) * 100),
    };
  } catch (error) {
    console.error('Error in vector pre-filtering:', error);
    // Fallback to processing all emails if vector similarity fails
    // eslint-disable-next-line no-console
    console.log('Falling back to processing all emails due to vector similarity error');
    return {
      likelyWebDevEmails: emails,
      unlikelyEmails: [],
      totalEmails: emails.length,
      reductionPercentage: 0,
    };
  }
}

// Simple cosine similarity calculation
export function calculateCosineSimilarity(embedding1, embedding2) {
  // Parse embeddings - they come as strings like "[0.1,0.2,0.3]"
  const vec1 = typeof embedding1 === 'string' ? JSON.parse(embedding1) : embedding1;
  const vec2 = typeof embedding2 === 'string' ? JSON.parse(embedding2) : embedding2;

  // Calculate dot product and norms
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  // Return cosine similarity
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// Helper function to update web development category threshold
export function updateWebDevThreshold(newThreshold) {
  WEB_DEV_CATEGORY.threshold = newThreshold;
}

// Helper function to get current web development threshold
export function getWebDevThreshold() {
  return WEB_DEV_CATEGORY.threshold;
}
