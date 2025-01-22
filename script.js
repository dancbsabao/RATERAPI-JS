// Constants
const CLIENT_ID = '664452848019-2vjidcmjkejj9oefokebmseod2jqbtn6.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBCRgVKU6GV-SGmn-SNBfcku4tQLBOtX_o';
const SHEET_ID = '1ZLVppZQEq4KwLrmmxU6JLAomB_vOvlCSswkck41SXGo';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const EVALUATOR_PASSWORDS = {
  'Chairperson': 'chair123',
  'Vice-Chairperson': 'vice123',
  'In-charge, Administrative Division': 'admin123',
  'Gender and Development': 'gen123',
  'DENR Employees Union': 'denreu123',
  'End-User': 'end123'
};

// Sheet ranges
const SHEET_RANGES = {
  VACANCIES: 'VACANCIES!A:C',
  CANDIDATES: 'CANDIDATES!A:B',
  COMPECODE: 'COMPECODE!A:B',
  COMPETENCY: 'COMPETENCY!A:B',
  RATELOG: 'RATELOG!A:H',
};

// Auth variables
let tokenClient;
let gapiInitialized = false;
let gisInitialized = false;
let currentEvaluator = null;

// DOM elements
const elements = {
  authStatus: document.getElementById('authStatus'),
  signInBtn: document.getElementById('signInBtn'),
  signOutBtn: document.getElementById('signOutBtn'),
  assignmentDropdown: document.getElementById('assignmentDropdown'),
  positionDropdown: document.getElementById('positionDropdown'),
  itemDropdown: document.getElementById('itemDropdown'),
  nameDropdown: document.getElementById('nameDropdown'),
  competencyContainer: document.getElementById('competencyContainer'),
  submitRatings: document.getElementById('submitRatings'),
};

// Initialize the Google API client
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
  });
  gapiInitialized = true;
  maybeEnableButtons();
}

// Initialize the Google Identity Services (GIS) client
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', // Will set during sign-in
  });
  gisInitialized = true;
  maybeEnableButtons();
}

// Enable sign-in/out buttons if both GAPI and GIS are initialized
function maybeEnableButtons() {
  if (gapiInitialized && gisInitialized) {
    elements.signInBtn.style.display = 'block';
    elements.authStatus.textContent = 'Ready to sign in';
  }
}

// Handle authentication
function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error) {
      elements.authStatus.textContent = 'Error during sign-in';
      return console.error('Auth error:', resp.error);
    }
    elements.authStatus.textContent = 'Signed in';
    elements.signInBtn.style.display = 'none';
    elements.signOutBtn.style.display = 'block';
    await loadSheetData();
  };
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

function handleSignOutClick() {
  const token = gapi.client.getToken();
  if (token) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      gapi.client.setToken(null);
      elements.authStatus.textContent = 'Signed out';
      elements.signInBtn.style.display = 'block';
      elements.signOutBtn.style.display = 'none';
    });
  }
}

// Load data from Google Sheets
// Declare global variables
let vacancies = [];
let candidates = [];
let compeCodes = [];
let competencies = [];

// Function to load data from Google Sheets
async function loadSheetData() {
  try {
    const ranges = Object.values(SHEET_RANGES);
    const data = await Promise.all(
      ranges.map((range) =>
        gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range,
        })
      )
    );

    // Assign data to global variables
    vacancies = data[0]?.result?.values || [];
    candidates = data[1]?.result?.values || [];
    compeCodes = data[2]?.result?.values || [];
    competencies = data[3]?.result?.values || [];

    // Initialize dropdowns with loaded data
    initializeDropdowns(vacancies, candidates, compeCodes, competencies);
  } catch (error) {
    console.error('Error loading data:', error);
    elements.authStatus.textContent = 'Error loading sheet data';
  }
}

// Generic dropdown update function
function updateDropdown(dropdown, options, defaultOptionText = 'Select') {
  dropdown.innerHTML = `<option value="">${defaultOptionText}</option>`;
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    dropdown.appendChild(option);
  });
}











function initializeDropdowns(vacancies, candidates, compeCodes, competencies) {
  // Helper function to disable/enable dropdown
  function setDropdownState(dropdown, enabled) {
      dropdown.disabled = !enabled;
      if (!enabled) {
          dropdown.value = '';
          dropdown.innerHTML = `<option value="">${dropdown.getAttribute('data-placeholder') || 'Select Option'}</option>`;
      }
  }

  // Set initial placeholders
  elements.assignmentDropdown.setAttribute('data-placeholder', 'Select Assignment');
  elements.positionDropdown.setAttribute('data-placeholder', 'Select Position');
  elements.itemDropdown.setAttribute('data-placeholder', 'Select Item');
  elements.nameDropdown.setAttribute('data-placeholder', 'Select Name');

  // Initialize assignment dropdown
  const uniqueAssignments = [...new Set(vacancies.slice(1).map((row) => row[2]))];
  updateDropdown(elements.assignmentDropdown, uniqueAssignments, 'Select Assignment');
  
  // Disable other dropdowns initially
  setDropdownState(elements.positionDropdown, false);
  setDropdownState(elements.itemDropdown, false);
  setDropdownState(elements.nameDropdown, false);

  // Assignment change handler
  elements.assignmentDropdown.addEventListener('change', () => {
      const assignment = elements.assignmentDropdown.value;
      
      if (assignment) {
          const positions = vacancies
              .filter((row) => row[2] === assignment)
              .map((row) => row[1]);
          updateDropdown(elements.positionDropdown, [...new Set(positions)], 'Select Position');
          setDropdownState(elements.positionDropdown, true);
      } else {
          setDropdownState(elements.positionDropdown, false);
      }
      
      // Reset and disable dependent dropdowns
      setDropdownState(elements.itemDropdown, false);
      setDropdownState(elements.nameDropdown, false);
  });

  // Position change handler
  elements.positionDropdown.addEventListener('change', () => {
      const assignment = elements.assignmentDropdown.value;
      const position = elements.positionDropdown.value;
      
      if (assignment && position) {
          const items = vacancies
              .filter((row) => row[2] === assignment && row[1] === position)
              .map((row) => row[0]);
          updateDropdown(elements.itemDropdown, [...new Set(items)], 'Select Item');
          setDropdownState(elements.itemDropdown, true);
      } else {
          setDropdownState(elements.itemDropdown, false);
      }
      
      // Reset and disable name dropdown
      setDropdownState(elements.nameDropdown, false);
  });

  // Item change handler
  elements.itemDropdown.addEventListener('change', () => {
      const item = elements.itemDropdown.value;
      
      if (item) {
          const names = candidates
              .filter((row) => row[1] === item)
              .map((row) => row[0]);
          updateDropdown(elements.nameDropdown, [...new Set(names)], 'Select Name');
          setDropdownState(elements.nameDropdown, true);
      } else {
          setDropdownState(elements.nameDropdown, false);
      }
  });

  // Name change handler
  elements.nameDropdown.addEventListener('change', () => {
      const item = elements.itemDropdown.value;
      const name = elements.nameDropdown.value;
      
      if (item && name) {
          const selectedCodes = compeCodes
              .filter((row) => row[0] === item)
              .flatMap((row) => row[1].split(','));
          const relatedCompetencies = competencies
              .filter((row) => selectedCodes.includes(row[0]))
              .map((row) => row[1]);
          displayCompetencies(name, relatedCompetencies);
      }
  });
}







// Display Competencies
async function fetchCompetenciesFromSheet() {
    try {
      const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, // Replace with your actual sheet ID
        range: 'ALLCOMPE!A:B',    // Fetch from Columns A and B
      });
  
      const competenciesColumn1 = response.result.values
        ? response.result.values.map(row => row[0]).filter(value => value)  // Get Column A competencies
        : [];
        
      const competenciesColumn2 = response.result.values
        ? response.result.values.map(row => row[1]).filter(value => value)  // Get Column B competencies
        : [];
  
      return { competenciesColumn1, competenciesColumn2 };
    } catch (error) {
      console.error('Error fetching competencies from sheet:', error);
      alert('Error fetching competencies.');
      return { competenciesColumn1: [], competenciesColumn2: [] };
    }
  }
  
  async function displayCompetencies(name, competencies) {
    const { competenciesColumn1, competenciesColumn2 } = await fetchCompetenciesFromSheet(); // Fetch from sheet
  
    elements.competencyContainer.innerHTML = `<h3>BASIC COMPETENCIES</h3>`; // Title for Column A Competencies
  
    // Display Column A competencies (1-5)
    competenciesColumn1.forEach((comp, idx) => {
      if (idx < 5) {  // Limit to 5 items
        const div = document.createElement('div');
        div.className = 'competency-item';
        div.innerHTML = `
          <label>${idx + 1}. ${comp}</label>
          <div class="rating-container">
            ${[1, 2, 3, 4, 5].map((val) => `
              <input type="radio" id="${comp}-${val}" name="${comp}" value="${val}">
              <label for="${comp}-${val}">${val}</label>`).join('')}
          </div>
        `;
        elements.competencyContainer.appendChild(div);
  
        // Add event listener to each radio button to track selection
        Array.from(div.querySelectorAll('input[type="radio"]')).forEach(radio => {
          radio.addEventListener('change', () => {
            checkAllRatingsSelected();
          });
        });
      }
    });
  
    // Display Column B competencies (1-5)
    elements.competencyContainer.innerHTML += `<h3>ORGANIZATIONAL COMPETENCIES</h3>`; // Title for Column B Competencies
  
    competenciesColumn2.forEach((comp, idx) => {
      if (idx < 5) {  // Limit to 5 items
        const div = document.createElement('div');
        div.className = 'competency-item';
        div.innerHTML = `
          <label>${idx + 1}. ${comp}</label>
          <div class="rating-container">
            ${[1, 2, 3, 4, 5].map((val) => `
              <input type="radio" id="${comp}-${val}" name="${comp}" value="${val}">
              <label for="${comp}-${val}">${val}</label>`).join('')}
          </div>
        `;
        elements.competencyContainer.appendChild(div);
  
        // Add event listener to each radio button to track selection
        Array.from(div.querySelectorAll('input[type="radio"]')).forEach(radio => {
          radio.addEventListener('change', () => {
            checkAllRatingsSelected();
          });
        });
      }
    });
  
    // Display remaining competencies under "MINIMUM COMPETENCIES"
    elements.competencyContainer.innerHTML += `<h3>MINIMUM COMPETENCIES</h3>`; // Title for other competencies
  
    // Start numbering from 1 for MINIMUM COMPETENCIES
    let minimumCompetencyNumber = 1;
  
    // Display other competencies (Ordinally numbered based on how many there are)
    competencies.forEach((comp, idx) => {
      const div = document.createElement('div');
      div.className = 'competency-item';
      div.innerHTML = `
        <label>${minimumCompetencyNumber++}. ${comp}</label>
        <div class="rating-container">
          ${[1, 2, 3, 4, 5].map((val) => `
            <input type="radio" id="${comp}-${val}" name="${comp}" value="${val}">
            <label for="${comp}-${val}">${val}</label>`).join('')}
        </div>
      `;
      elements.competencyContainer.appendChild(div);
  
      // Add event listener to each radio button to track selection
      Array.from(div.querySelectorAll('input[type="radio"]')).forEach(radio => {
        radio.addEventListener('change', () => {
          checkAllRatingsSelected();
        });
      });
    });













  
    // Enable the submit button once all ratings are selected
    function checkAllRatingsSelected() {
      const allRated = Array.from(elements.competencyContainer.getElementsByClassName('competency-item'))
        .every(item => Array.from(item.getElementsByTagName('input')).some(input => input.checked));
      
      elements.submitRatings.disabled = !allRated; // Disable submit button if not all ratings are selected
    }
  
    // Add functionality to reset ratings
    const resetButton = document.createElement('button');
    resetButton.textContent = "Reset Ratings";
    resetButton.addEventListener('click', () => {
      Array.from(elements.competencyContainer.getElementsByClassName('competency-item')).forEach(item => {
        Array.from(item.getElementsByTagName('input')).forEach(input => input.checked = false);
      });
      checkAllRatingsSelected();  // Recheck if submit button should be enabled
    });
    elements.competencyContainer.appendChild(resetButton);
    
    // Initial check to enable/disable the submit button
    checkAllRatingsSelected();
  }
  





  
  
  let fetchTimeout;

  async function fetchSubmittedRatings() {
    // Clear any ongoing fetches if the user rapidly switches names
    if (fetchTimeout) clearTimeout(fetchTimeout);
  
    // Delay fetching to ensure stable selection
    fetchTimeout = setTimeout(async () => {
      const name = elements.nameDropdown.value; // Selected candidate name
      const item = elements.itemDropdown.value; // Selected item
  
      // Check if an evaluator is selected and authenticated
      if (!currentEvaluator) {
        console.warn('No evaluator selected or authenticated.');
        return;
      }
  
      // Clear existing ratings
      clearRatings();
  
      if (!name || !item) {
        console.warn('Name or item not selected.');
        return;
      }
  
      try {
        // Fetch data from the RATELOG sheet
        const response = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: SHEET_RANGES.RATELOG, // Use RATELOG range from constants
        });
  
        const data = response.result.values || [];
        const headers = data[0]; // Header row
        const rows = data.slice(1); // Actual data rows
  
        // Filter rows matching the selected name, item, and authenticated evaluator (column 6 - index 5)
        const filteredRows = rows.filter(row =>
          row[2] === name && row[1] === item && row[5] === currentEvaluator
        );
  
        if (filteredRows.length === 0) {
          console.warn('No ratings found for the selected name, item, and evaluator.');
          return;
        }
  
        // Create a mapping of competency names to ratings, now including evaluator
        const competencyRatings = {};
        filteredRows.forEach(row => {
          const competencyName = row[3]; // Column 4 (index 3) for competency name
          const rating = row[4]; // Column 5 (index 4) for rating
          
          // Ensure the competency name exists in the map, and include evaluator-based rating
          if (!competencyRatings[competencyName]) {
            competencyRatings[competencyName] = {};
          }
          competencyRatings[competencyName][currentEvaluator] = rating;
        });
  
        console.log('Competency Ratings:', competencyRatings); // Debugging line
  
        // Pre-fill the competency ratings in the DOM
        prefillRatings(competencyRatings);
  
      } catch (error) {
        console.error('Error fetching submitted ratings:', error);
        alert('Error fetching submitted ratings. Please try again.');
      }
    }, 300); // Debounce delay (300ms)
  }
  
  // Clear all ratings in the DOM
  function clearRatings() {
    const competencyItems = elements.competencyContainer.getElementsByClassName('competency-item');
    Array.from(competencyItems).forEach(item => {
      const radios = item.querySelectorAll('input[type="radio"]');
      radios.forEach(radio => (radio.checked = false)); // Uncheck all radio buttons
    });
  }
  
  // Pre-fill the competency ratings
  function prefillRatings(competencyRatings) {
    const competencyItems = elements.competencyContainer.getElementsByClassName('competency-item');
  
    Array.from(competencyItems).forEach(item => {
      const competencyName = item.querySelector('label').textContent.split('. ')[1]; // Extract competency name
      const rating = competencyRatings[competencyName] ? competencyRatings[competencyName][currentEvaluator] : null; // Get rating for this evaluator
  
      console.log(`Prefilling rating for: ${competencyName}, Evaluator: ${currentEvaluator}, Rating: ${rating}`); // Debugging line
  
      if (rating) {
        // Select the radio button matching the rating
        const radio = item.querySelector(`input[type="radio"][value="${rating}"]`);
        if (radio) {
          radio.checked = true;
        } else {
          console.warn(`No radio button found for rating ${rating} in competency ${competencyName}`); // Debugging line
        }
      } else {
        console.warn(`No rating found for competency ${competencyName} and evaluator ${currentEvaluator}`); // Debugging line
      }
    });
  }
  
  // Make sure to call the fetchSubmittedRatings function at appropriate times, for example:
  // elements.nameDropdown.addEventListener('change', fetchSubmittedRatings);
  // elements.itemDropdown.addEventListener('change', fetchSubmittedRatings);
  

  // Add this function to the name dropdown's change event listener
  elements.nameDropdown.addEventListener('change', fetchSubmittedRatings);
  elements.itemDropdown.addEventListener('change', fetchSubmittedRatings);
  











// Submit ratings (unchanged logic)

// Add this function to create and append evaluator selector
document.addEventListener('DOMContentLoaded', () => {
  function createEvaluatorSelector() {
      const formGroup = document.createElement('div');
      formGroup.className = 'form-group';
      
      const label = document.createElement('label');
      label.htmlFor = 'evaluatorSelect';
      label.textContent = 'Evaluator:';
      
      const select = document.createElement('select');
      select.id = 'evaluatorSelect';
      select.required = true;
      
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select Evaluator';
      select.appendChild(defaultOption);
      
      Object.keys(EVALUATOR_PASSWORDS).forEach(evaluator => {
          const option = document.createElement('option');
          option.value = evaluator;
          option.textContent = evaluator;
          select.appendChild(option);
      });
      
      select.addEventListener('change', handleEvaluatorSelection);
      
      formGroup.appendChild(label);
      formGroup.appendChild(select);
      
      // Insert at the beginning of the rating form
      const ratingForm = document.querySelector('.rating-form');
      if (ratingForm) {
          ratingForm.insertBefore(formGroup, ratingForm.firstChild);
      } else {
          console.error('Error: .rating-form element not found in the DOM.');
      }
  }

  // Call the function after DOM is fully loaded
  createEvaluatorSelector();
});










async function handleEvaluatorSelection(event) {
  const selectElement = event.target;
  const newSelection = selectElement.value;
  
  // Immediately revert the select element to current evaluator
  selectElement.value = currentEvaluator || '';
  
  // If no evaluator is selected, reset and exit
  if (!newSelection) {
      currentEvaluator = null;
      console.log('No evaluator selected. Resetting dropdowns.');
      resetDropdowns(vacancies);
      return;
  }

  const modalContent = `
      <p>Please enter the password for ${newSelection}:</p>
      <input type="password" id="evaluatorPassword" class="modal-input" 
             style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-top: 10px;">
  `;

  showModal('Evaluator Authentication', modalContent, () => {
      const passwordInput = document.getElementById('evaluatorPassword');
      const password = passwordInput.value.trim();

      if (password === EVALUATOR_PASSWORDS[newSelection]) {
          // Only update the select element and currentEvaluator after successful authentication
          selectElement.value = newSelection;
          currentEvaluator = newSelection;
          console.log(`Logged in successfully as ${newSelection}`);
          showToast('success', 'Success', `Logged in as ${newSelection}`);

          // Reset dropdowns
          console.log('Resetting dropdowns for the new evaluator.');
          resetDropdowns(vacancies);
          fetchSubmittedRatings();
      } else {
          console.error('Incorrect password.');
          showToast('error', 'Error', 'Incorrect password');
          // Select element is already set to the previous value
      }
  });
}












// Function to reset all dropdowns to their default state
function resetDropdowns(vacancies) {
  console.log('Fetching unique assignments to reset the dropdowns.');

  // Ensure vacancies is defined
  if (!vacancies || !Array.isArray(vacancies)) {
    console.error('Error: vacancies data is undefined or invalid.');
    return;
  }

  // Reset Assignments dropdown
  const uniqueAssignments = [...new Set(vacancies.slice(1).map((row) => row[2]))];
  updateDropdown(elements.assignmentDropdown, uniqueAssignments, 'Select Assignment');

  // Clear dependent dropdowns
  updateDropdown(elements.positionDropdown, [], 'Select Position');
  updateDropdown(elements.itemDropdown, [], 'Select Item');
  updateDropdown(elements.nameDropdown, [], 'Select Name');

  // Reset dropdown values explicitly
  elements.assignmentDropdown.value = '';
  elements.positionDropdown.value = '';
  elements.itemDropdown.value = '';
  elements.nameDropdown.value = '';

  console.log('Dropdowns reset successfully.');
}

// Generic dropdown update function
function updateDropdown(dropdown, options, defaultOptionText = 'Select') {
  dropdown.innerHTML = `<option value="">${defaultOptionText}</option>`;
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    dropdown.appendChild(option);
  });
  console.log(`Dropdown ${dropdown.id} updated with options:`, options);
}























// Modify your existing submitRatings function to include evaluator check
async function submitRatings() {
  const token = gapi.client.getToken();
  if (!token) {
      showToast('error', 'Error', 'Please sign in to submit ratings');
      handleAuthClick();
      return;
  }

  if (!currentEvaluator) {
      showToast('warning', 'Warning', 'Please select an evaluator and enter the correct password');
      return;
  }

  const item = elements.itemDropdown.value;
  const candidateName = elements.nameDropdown.value;

  if (!item || !candidateName) {
      showToast('error', 'Error', 'Please select both item and candidate before submitting the ratings.');
      return;
  }

  const competencyItems = elements.competencyContainer.getElementsByClassName('competency-item');

  function getInitials(name) {
      return name.split(' ').map(word => word.slice(0, 3)).join('');
  }

  function getCompetencyCode(competencyName) {
      return competencyName.split(' ').map(word => word.charAt(0).replace(/[^A-Za-z]/g, '')).join('');
  }

  const candidateInitials = getInitials(candidateName);
  const competencies = Array.from(competencyItems).map(item => item.querySelector('label').textContent.split('. ')[1]);
  const ratings = [];
  let allRated = true;

  for (let i = 0; i < competencyItems.length; i++) {
      const competencyName = competencies[i];
      const rating = Array.from(competencyItems[i].querySelectorAll('input[type="radio"]'))
          .find(radio => radio.checked)?.value;

      if (!rating) {
          allRated = false;
          break;
      }

      const competencyCode = getCompetencyCode(competencyName);
      const ratingCode = `${item}-${candidateInitials}-${competencyCode}-${currentEvaluator}`;
      ratings.push([ratingCode, item, candidateName, competencyName, rating, currentEvaluator]);
  }

  if (!allRated) {
      showToast('error', 'Error', 'Please rate all competencies before submitting.');
      return;
  }

  try {
      const response = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: SHEET_RANGES.RATELOG,
      });

      const existingData = response.result.values || [];
      const updatedRatings = [];
      const newRatings = [];
      let isUpdated = false;

      ratings.forEach(newRating => {
          const existingRowIndex = existingData.findIndex(row => row[0] === newRating[0]);
          if (existingRowIndex !== -1) {
              existingData[existingRowIndex] = newRating;
              isUpdated = true;
          } else {
              newRatings.push(newRating);
          }
      });

      if (isUpdated) {
          await gapi.client.sheets.spreadsheets.values.update({
              spreadsheetId: SHEET_ID,
              range: SHEET_RANGES.RATELOG,
              valueInputOption: 'RAW',
              resource: { values: existingData },
          });
      }

      if (newRatings.length > 0) {
          await gapi.client.sheets.spreadsheets.values.append({
              spreadsheetId: SHEET_ID,
              range: SHEET_RANGES.RATELOG,
              valueInputOption: 'RAW',
              resource: { values: newRatings },
          });
      }

      showToast('success', 'Success', isUpdated ? 'Ratings updated successfully' : 'Ratings submitted successfully');
  } catch (error) {
      console.error('Error submitting ratings:', error);
      showToast('error', 'Error', 'Error submitting ratings');
  }
}

// Add this to your existing handleAuthClick callback
function onSignInSuccess() {
  elements.authStatus.textContent = 'Signed in';
  elements.signInBtn.style.display = 'none';
  elements.signOutBtn.style.display = 'block';
  createEvaluatorSelector(); // Add evaluator selector after successful sign-in
  loadSheetData();
}


// Event Listeners
elements.signInBtn.addEventListener('click', handleAuthClick);
elements.signOutBtn.addEventListener('click', handleSignOutClick);

// Load APIs
gapiLoaded();
gisLoaded();
