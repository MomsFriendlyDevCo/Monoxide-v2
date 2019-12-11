module.exports = {
	// Users {{{
	users: [
		{
			_ref: 'users.joe',
			name: 'Joe Random',
			status: 'active',
			company: 'company.acme',
			role: 'user',
			favourite: {
				color: 'red',
				animal: 'dog',
			},
			_password: 'ue', // INPUT: flume
		},
		{
			_ref: 'users.jane',
			name: 'Jane Quark',
			status: 'active',
			company: 'company.acme',
			role: 'user',
			favourite: {
				color: 'yellow',
				animal: 'cat',
			},
			_password: 'oeaeoeae', // INPUT: correct battery horse staple
		},
		{
			_ref: 'users.bob',
			name: 'Bob Bobart',
			status: 'unverified',
			company: 'company.acme',
			role: 'user',
			favourite: {
				color: 'yellow',
				animal: 'dog',
			},
			_password: 'ao', // INPUT: password
		},
		{
			_ref: 'users.dick',
			name: 'Dick deleteed',
			status: 'deleted',
			company: 'company.aperture',
			role: 'user',
			favourite: {
				color: 'blue',
				animal: 'squirrel',
			},
			_password: 'ao', // INPUT: password
		},
		{
			_ref: 'users.vallery',
			name: 'Vallery Unverrifed',
			status: 'unverified',
			company: 'company.aperture',
			role: 'user',
			favourite: {
				color: 'blue',
				animal: 'dog',
			},
			_password: 'ao', // INPUT: password
		},
		{
			_ref: 'users.don',
			name: 'Don Delete',
			status: 'deleted',
			company: 'company.acme',
			role: 'user',
			favourite: {
				color: 'red',
				animal: 'dog',
			},
			_password: 'ao', // INPUT: password
		},
		{
			_ref: 'users.adam',
			name: 'Adam Admin',
			status: 'active',
			company: 'company.acme',
			role: 'admin',
			favourite: {
				color: 'red',
				animal: 'dog',
			},
			_password: 'ao', // INPUT: password
		},
	],
	// }}}
	// Companies {{{
	companies: [
		{
			_ref: 'company.acme',
			name: 'Acme Inc',
		},
		{
			_ref: 'company.aperture',
			name: 'Aperture Science',
		},
		{
			_ref: 'company.empty',
			name: 'Empty Box Incoporated',
		},
	],
	// }}}
};
