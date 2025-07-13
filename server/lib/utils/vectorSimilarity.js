import { getEmbedding } from './ollamaEmbed.js';
import { checkWebDevKeywords } from './emailAnalysis.js';

// Vector pre-filtering for web development emails
export async function preFilterWebDevEmails(emails) {
  try {
    console.log('🔍 Pre-filtering emails using vector similarity...');

    // Create a reference embedding for "web development emails"
    const webDevReference = `
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
      RAG vector database
    `;

    const referenceEmbedding = await getEmbedding(webDevReference);

    // Calculate similarity for each email
    const emailsWithSimilarity = await Promise.all(
      emails.map(async (email) => {
        const emailContent = `${email.subject} ${email.body} ${email.from}`;
        const emailEmbedding = await getEmbedding(emailContent);

        // Calculate cosine similarity
        const similarity = calculateCosineSimilarity(referenceEmbedding, emailEmbedding);

        console.log(
          `📧 Email: "${email.subject.substring(0, 50)}..." - Similarity: ${similarity.toFixed(3)}`,
        );

        return {
          ...email,
          similarity,
          likelyWebDev: similarity > 0.52, // Match the analysis threshold
        };
      }),
    );

    // Sort by similarity and return top candidates
    const sortedEmails = emailsWithSimilarity.sort((a, b) => b.similarity - a.similarity);

    // Always include at least the top 3 most similar emails (or fewer if less than 3 total)
    const minEmailsToAnalyze = Math.min(3, emails.length);
    const likelyWebDevEmails = sortedEmails.slice(
      0,
      Math.max(minEmailsToAnalyze, sortedEmails.filter((email) => email.likelyWebDev).length),
    );
    const unlikelyEmails = sortedEmails.slice(likelyWebDevEmails.length);

    console.log(`📊 Vector pre-filtering results:
      - Total emails: ${emails.length}
      - Likely web-dev: ${likelyWebDevEmails.length}
      - Unlikely: ${unlikelyEmails.length}
      - LLM calls reduced by: ${Math.round((unlikelyEmails.length / emails.length) * 100)}%`);

    return {
      likelyWebDevEmails,
      unlikelyEmails,
      totalEmails: emails.length,
      reductionPercentage: Math.round((unlikelyEmails.length / emails.length) * 100),
    };
  } catch (error) {
    console.error('Error in vector pre-filtering:', error);
    // Fallback to keyword filtering if vector fails
    return {
      likelyWebDevEmails: emails.filter((email) =>
        checkWebDevKeywords(email.subject, email.body, email.from),
      ),
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
