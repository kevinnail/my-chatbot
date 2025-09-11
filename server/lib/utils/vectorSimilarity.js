import { getEmbedding } from './ollamaEmbed.js';

// Email category definitions - easily extensible for new types
const EMAIL_CATEGORIES = {
  web_dev: {
    threshold: 0.52,
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
      RAG vector database
    `,
  },
  appointment: {
    threshold: 0.55,
    referenceText: `
      appointment scheduled meeting call doctor dentist medical clinic hospital consultation
      follow-up catch up phone call video call zoom teams coffee lunch dinner one-on-one
      standup sync check-in service maintenance reminder calendar invite invitation
      reschedule confirm confirmation appointment booking schedule meeting room
      healthcare medical checkup dental cleaning eye exam physical therapy massage
      haircut salon spa grooming pet vet veterinary service repair technician
      plumber electrician contractor handyman delivery pickup installation setup
      client meeting sales call demo presentation interview performance review
      social event date hangout party celebration birthday anniversary wedding
      conference workshop seminar training session course lesson tutorial
      government appointment DMV passport visa embassy consulate court hearing
      financial advisor bank loan mortgage insurance real estate showing
      therapy counseling coaching mentoring spiritual guidance religious service
    `,
  },
};

// Vector pre-filtering for categorized emails
export async function preFilterWebDevEmails(emails) {
  try {
    // eslint-disable-next-line no-console
    console.log('Pre-filtering emails using vector similarity...');

    // Generate embeddings for all categories
    const categoryEmbeddings = {};
    for (const [categoryName, config] of Object.entries(EMAIL_CATEGORIES)) {
      categoryEmbeddings[categoryName] = await getEmbedding(config.referenceText);
    }

    // Calculate similarity for each email against all categories
    const emailsWithSimilarity = await Promise.all(
      emails.map(async (email) => {
        const emailContent = `${email.subject} ${email.body} ${email.from}`;
        const emailEmbedding = await getEmbedding(emailContent);

        // Calculate similarity scores for all categories
        const categoryScores = {};
        let bestCategory = null;
        let bestScore = 0;

        for (const [categoryName, config] of Object.entries(EMAIL_CATEGORIES)) {
          const similarity = calculateCosineSimilarity(
            categoryEmbeddings[categoryName],
            emailEmbedding,
          );
          categoryScores[categoryName] = similarity;

          if (similarity > config.threshold && similarity > bestScore) {
            bestCategory = categoryName;
            bestScore = similarity;
          }
        }

        // Determine the primary category and reason
        const reason = bestCategory || 'low_similarity';

        console.log(
          ` Email: "${email.subject.substring(0, 50)}..." - Best: ${bestCategory || 'none'} (${bestScore.toFixed(3)}) - Scores: ${Object.entries(
            categoryScores,
          )
            .map(([cat, score]) => `${cat}:${score.toFixed(3)}`)
            .join(', ')}`,
        );

        return {
          ...email,
          similarity: categoryScores.web_dev, // Keep for backward compatibility
          categoryScores,
          primaryCategory: bestCategory,
          bestScore,
          likelyWebDev: bestCategory === 'web_dev',
          isAppointmentRelated: bestCategory === 'appointment',
          reason,
        };
      }),
    );

    // Sort by best similarity score across all categories
    const sortedEmails = emailsWithSimilarity.sort((a, b) => b.bestScore - a.bestScore);

    // Always include at least the top 3 most similar emails (or fewer if less than 3 total)
    const minEmailsToAnalyze = Math.min(3, emails.length);
    const likelyWebDevEmails = sortedEmails.slice(
      0,
      Math.max(minEmailsToAnalyze, sortedEmails.filter((email) => email.likelyWebDev).length),
    );
    const unlikelyEmails = sortedEmails.slice(likelyWebDevEmails.length);

    // Categorize emails for reporting
    const appointmentEmails = emailsWithSimilarity.filter((email) => email.isAppointmentRelated);
    const webDevEmails = emailsWithSimilarity.filter(
      (email) => email.likelyWebDev && !email.isAppointmentRelated,
    );
    const lowSimilarityEmails = emailsWithSimilarity.filter(
      (email) => !email.likelyWebDev && !email.isAppointmentRelated,
    );

    // eslint-disable-next-line no-console
    console.log(`Vector pre-filtering results:
      - Total emails: ${emails.length}
      - Web-dev emails: ${webDevEmails.length}
      - Appointment emails: ${appointmentEmails.length}
      - Low similarity: ${lowSimilarityEmails.length}
      - LLM calls reduced by: ${emails.length === 0 ? 0 : Math.round((lowSimilarityEmails.length / emails.length) * 100)}%`);

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

// Helper function to add new email categories dynamically
export function addEmailCategory(categoryName, referenceText, threshold = 0.55) {
  EMAIL_CATEGORIES[categoryName] = {
    threshold,
    referenceText,
  };
}

// Helper function to get all available categories
export function getAvailableCategories() {
  return Object.keys(EMAIL_CATEGORIES);
}
